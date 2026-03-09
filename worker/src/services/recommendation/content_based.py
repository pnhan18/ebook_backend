import numpy as np
import re
import pickle
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional
from src.config import get_db, get_redis


class ContentBasedRecommender:
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    # Review filtering config
    MIN_REVIEW_LENGTH = 20  # Tối thiểu 20 ký tự
    MAX_REVIEWS_PER_BOOK = 10  # Lấy tối đa 10 reviews/book
    MIN_RATING_FOR_REVIEW = 3  # Chỉ lấy review từ rating >= 3 sao

    # Spam patterns (Vietnamese + English)
    SPAM_PATTERNS = [
        r"^(ok|tốt|hay|good|nice|great|bad|dở|tệ|\.+|!+|\?+)$",
        r"(http|www\.|\.com|\.vn)",
        r"(\d{10,})",
        r"(zalo|facebook|fb|telegram|tele)",
        r"(.)\1{4,}",
        r"^[\W\d\s]+$",
    ]

    def __init__(self, redis_client=None):
        self.db = None
        self.redis = redis_client or get_redis()
        self.model = None
        self.book_embeddings = None
        self.book_ids = []
        self.book_id_to_idx = {}  # O(1) lookup thay vì O(n)
        self._spam_regex = [
            re.compile(p, re.IGNORECASE) for p in self.SPAM_PATTERNS
        ]

    def _load_model(self):
        if self.model is None:
            print(f"Loading Sentence-BERT model: {self.MODEL_NAME}")
            self.model = SentenceTransformer(self.MODEL_NAME)
        return self.model

    async def _ensure_db(self):
        if self.db is None:
            self.db = get_db()

    def _is_spam_review(self, review: str) -> bool:
        """Kiểm tra review có phải spam/noise không"""
        if not review:
            return True

        review = review.strip()

        # Quá ngắn
        if len(review) < self.MIN_REVIEW_LENGTH:
            return True

        # Check spam patterns
        for pattern in self._spam_regex:
            if pattern.search(review):
                return True

        # Tỷ lệ chữ cái quá thấp (spam toàn emoji/số)
        alpha_chars = sum(1 for c in review if c.isalpha())
        if len(review) > 0 and alpha_chars / len(review) < 0.5:
            return True

        return False

    def _clean_review(self, review: str) -> str:
        """Làm sạch review text"""
        if not review:
            return ""

        # Remove extra whitespace
        review = " ".join(review.split())

        # Remove emoji (giữ lại text)
        review = re.sub(r"[\U00010000-\U0010ffff]", "", review)

        # Limit length
        if len(review) > 500:
            review = review[:500] + "..."

        return review.strip()

    def _create_book_text(self, book, reviews: List[str] = None) -> str:
        """Tạo text representation cho book, bao gồm cả reviews đã lọc"""
        parts = []

        # Title (weight x2)
        if book.title:
            parts.append(book.title)
            parts.append(book.title)

        # Description
        if book.description:
            desc = book.description[:1000]
            parts.append(desc)

        # Categories
        if book.categories:
            categories = " ".join([bc.category.name for bc in book.categories])
            parts.append(f"Thể loại: {categories}")

        # Authors
        if book.authors:
            authors = " ".join([ba.author.name for ba in book.authors])
            parts.append(f"Tác giả: {authors}")

        # Reviews (đã được lọc và clean)
        if reviews:
            reviews_text = " ".join(reviews)
            parts.append(f"Đánh giá: {reviews_text}")

        return " ".join(parts)

    async def _get_filtered_reviews(self, book_id: int) -> List[str]:
        """Lấy và lọc reviews chất lượng cho một book"""
        await self._ensure_db()

        # Lấy reviews có rating >= 3, sắp xếp theo rating cao nhất
        ratings = await self.db.rating.find_many(
            where={
                "bookId": book_id,
                "score": {"gte": self.MIN_RATING_FOR_REVIEW},
                "review": {"not": None},
            },
            order={"score": "desc"},
            take=self.MAX_REVIEWS_PER_BOOK * 2,  # Lấy dư để lọc
        )

        filtered_reviews = []
        for rating in ratings:
            if rating.review and not self._is_spam_review(rating.review):
                cleaned = self._clean_review(rating.review)
                if cleaned:
                    filtered_reviews.append(cleaned)
                    if len(filtered_reviews) >= self.MAX_REVIEWS_PER_BOOK:
                        break

        return filtered_reviews

    async def build_book_embeddings(self) -> Dict[int, np.ndarray]:
        await self._ensure_db()
        model = self._load_model()

        books = await self.db.book.find_many(
            where={"isActive": True, "status": "PUBLISHED"},
            include={
                "categories": {"include": {"category": True}},
                "authors": {"include": {"author": True}},
            },
        )

        if not books:
            return {}

        book_texts = []
        self.book_ids = []

        print(f"Processing {len(books)} books with reviews...")
        for book in books:
            # Lấy reviews đã lọc cho book này
            reviews = await self._get_filtered_reviews(book.id)
            text = self._create_book_text(book, reviews)
            book_texts.append(text)
            self.book_ids.append(book.id)

        # Build O(1) lookup dict
        self.book_id_to_idx = {bid: idx for idx, bid in enumerate(self.book_ids)}

        print(f"Encoding {len(book_texts)} books with Sentence-BERT...")
        self.book_embeddings = model.encode(
            book_texts,
            convert_to_numpy=True,
            show_progress_bar=True,
            batch_size=32,
        )
        print(f"Generated embeddings shape: {self.book_embeddings.shape}")

        if self.redis:
            await self._cache_embeddings()

        return {
            book_id: self.book_embeddings[idx]
            for idx, book_id in enumerate(self.book_ids)
        }

    async def _cache_embeddings(self):
        """Cache embeddings to Redis using pickle (faster than JSON for numpy)"""
        if self.redis and self.book_embeddings is not None:
            cache_data = {
                "book_ids": self.book_ids,
                "embeddings": self.book_embeddings,
            }
            self.redis.set(
                "recommendation:book_embeddings",
                pickle.dumps(cache_data),
                ex=86400 * 7,
            )

    async def _load_embeddings(self) -> bool:
        """Load embeddings from Redis using pickle"""
        if self.redis:
            data = self.redis.get("recommendation:book_embeddings")
            if data:
                cache_data = pickle.loads(data)
                self.book_ids = cache_data["book_ids"]
                self.book_embeddings = cache_data["embeddings"]
                # Rebuild O(1) lookup dict
                self.book_id_to_idx = {
                    bid: idx for idx, bid in enumerate(self.book_ids)
                }
                return True
        return False

    async def _ensure_embeddings(self):
        if self.book_embeddings is None:
            loaded = await self._load_embeddings()
            if not loaded:
                await self.build_book_embeddings()

    async def get_similar_books(
        self,
        book_id: int,
        limit: int = 10,
        exclude_ids: Optional[List[int]] = None,
    ) -> List[Dict]:
        await self._ensure_embeddings()

        if self.book_embeddings is None or book_id not in self.book_id_to_idx:
            return []

        book_idx = self.book_id_to_idx[book_id]  # O(1) lookup
        book_embedding = self.book_embeddings[book_idx].reshape(1, -1)
        similarities = cosine_similarity(
            book_embedding, self.book_embeddings
        ).flatten()
        similar_indices = similarities.argsort()[::-1]

        results = []
        exclude_ids = set(exclude_ids or [])
        exclude_ids.add(book_id)

        for idx in similar_indices:
            bid = self.book_ids[idx]
            if bid in exclude_ids:
                continue
            results.append({"book_id": bid, "score": float(similarities[idx])})
            if len(results) >= limit:
                break

        return results

    async def get_recommendations_for_user(
        self,
        user_id: int,
        limit: int = 10,
    ) -> List[Dict]:
        await self._ensure_db()
        await self._ensure_embeddings()

        if self.book_embeddings is None:
            return []

        recent_views = await self.db.bookview.find_many(
            where={"userId": user_id},
            order={"viewedAt": "desc"},
            take=20,
            distinct=["bookId"],
        )

        if not recent_views:
            return []

        viewed_book_ids = [v.bookId for v in recent_views]

        viewed_embeddings = []
        for bid in viewed_book_ids:
            if bid in self.book_id_to_idx:  # O(1) lookup
                idx = self.book_id_to_idx[bid]
                viewed_embeddings.append(self.book_embeddings[idx])

        if not viewed_embeddings:
            return []

        weights = np.array(
            [1.0 / (i + 1) for i in range(len(viewed_embeddings))]
        )
        weights = weights / weights.sum()
        user_profile = np.average(viewed_embeddings, axis=0, weights=weights)
        user_profile = user_profile.reshape(1, -1)

        similarities = cosine_similarity(
            user_profile, self.book_embeddings
        ).flatten()
        similar_indices = similarities.argsort()[::-1]

        results = []
        exclude_ids = set(viewed_book_ids)

        for idx in similar_indices:
            bid = self.book_ids[idx]
            if bid in exclude_ids:
                continue
            results.append({"book_id": bid, "score": float(similarities[idx])})
            if len(results) >= limit:
                break

        return results
