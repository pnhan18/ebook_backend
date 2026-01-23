import numpy as np
import re
import pickle
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional
from src.config import get_db, get_redis


class ContentBasedRecommender:
    MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

    MIN_REVIEW_LENGTH = 20
    MAX_REVIEWS_PER_BOOK = 10
    MIN_RATING_FOR_REVIEW = 3

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
        self.book_id_to_idx = {}
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

        if len(review) < self.MIN_REVIEW_LENGTH:
            return True

        for pattern in self._spam_regex:
            if pattern.search(review):
                return True

        alpha_chars = sum(1 for c in review if c.isalpha())
        if len(review) > 0 and alpha_chars / len(review) < 0.5:
            return True

        return False

    def _clean_review(self, review: str) -> str:
        """Làm sạch review text"""
        if not review:
            return ""

        review = " ".join(review.split())
        review = re.sub(r"[\U00010000-\U0010ffff]", "", review)

        if len(review) > 500:
            review = review[:500] + "..."

        return review.strip()

    def _create_book_text(self, book, reviews: List[str] = None) -> str:
        """Tạo text representation cho book"""
        parts = []

        if book.title:
            parts.append(book.title)
            parts.append(book.title)

        if book.description:
            desc = book.description[:1000]
            parts.append(desc)

        if book.categories:
            categories = " ".join([bc.category.name for bc in book.categories])
            parts.append(f"Thể loại: {categories}")

        if book.authors:
            authors = " ".join([ba.author.name for ba in book.authors])
            parts.append(f"Tác giả: {authors}")

        if reviews:
            reviews_text = " ".join(reviews)
            parts.append(f"Đánh giá: {reviews_text}")

        return " ".join(parts)

    async def _get_filtered_reviews(self, book_id: int) -> List[str]:
        """Lấy và lọc reviews chất lượng cho một book"""
        await self._ensure_db()

        ratings = await self.db.rating.find_many(
            where={
                "bookId": book_id,
                "score": {"gte": self.MIN_RATING_FOR_REVIEW},
                "review": {"not": None},
            },
            order={"score": "desc"},
            take=self.MAX_REVIEWS_PER_BOOK * 2,
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
            reviews = await self._get_filtered_reviews(book.id)
            text = self._create_book_text(book, reviews)
            book_texts.append(text)
            self.book_ids.append(book.id)

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
        """Cache embeddings to Redis using pickle"""
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
        """Tìm sách tương tự với category boosting"""
        await self._ensure_embeddings()
        await self._ensure_db()

        if self.book_embeddings is None or book_id not in self.book_id_to_idx:
            return []

        source_book = await self.db.book.find_unique(
            where={"id": book_id},
            include={
                "categories": {"include": {"category": True}},
                "authors": {"include": {"author": True}},
            },
        )

        if not source_book:
            return []

        source_category_ids = {bc.categoryId for bc in (source_book.categories or [])}
        source_author_ids = {ba.authorId for ba in (source_book.authors or [])}

        book_idx = self.book_id_to_idx[book_id]
        book_embedding = self.book_embeddings[book_idx].reshape(1, -1)
        similarities = cosine_similarity(
            book_embedding, self.book_embeddings
        ).flatten()

        SIMILARITY_THRESHOLD = 0.3
        candidates = []
        exclude_ids = set(exclude_ids or [])
        exclude_ids.add(book_id)

        for idx, sim_score in enumerate(similarities):
            bid = self.book_ids[idx]
            if bid in exclude_ids or sim_score < SIMILARITY_THRESHOLD:
                continue
            candidates.append({"book_id": bid, "base_score": float(sim_score)})

        if not candidates:
            similar_indices = similarities.argsort()[::-1]
            for idx in similar_indices[:limit * 3]:
                bid = self.book_ids[idx]
                if bid not in exclude_ids:
                    candidates.append({"book_id": bid, "base_score": float(similarities[idx])})

        if not candidates:
            return []

        candidate_ids = [c["book_id"] for c in candidates]
        candidate_books = await self.db.book.find_many(
            where={"id": {"in": candidate_ids}},
            include={
                "categories": {"include": {"category": True}},
                "authors": {"include": {"author": True}},
            },
        )

        book_info = {b.id: b for b in candidate_books}

        CATEGORY_BOOST = 0.3
        AUTHOR_BOOST = 0.4
        CATEGORY_PENALTY = 0.5

        results = []
        for candidate in candidates:
            bid = candidate["book_id"]
            base_score = candidate["base_score"]
            final_score = base_score

            if bid in book_info:
                book = book_info[bid]
                candidate_category_ids = {bc.categoryId for bc in (book.categories or [])}
                candidate_author_ids = {ba.authorId for ba in (book.authors or [])}

                category_overlap = source_category_ids & candidate_category_ids
                if category_overlap:
                    overlap_ratio = len(category_overlap) / max(len(source_category_ids), 1)
                    final_score += base_score * CATEGORY_BOOST * overlap_ratio
                elif source_category_ids and candidate_category_ids:
                    final_score *= CATEGORY_PENALTY

                if source_author_ids & candidate_author_ids:
                    final_score += base_score * AUTHOR_BOOST

            results.append({"book_id": bid, "score": final_score})

        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:limit]

    async def get_recommendations_for_user(
        self,
        user_id: int,
        limit: int = 10,
    ) -> List[Dict]:
        """Đề xuất sách cho user với category boosting"""
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

        viewed_books = await self.db.book.find_many(
            where={"id": {"in": viewed_book_ids}},
            include={"categories": {"include": {"category": True}}},
        )

        viewed_books_map = {b.id: b for b in viewed_books}

        from collections import Counter
        category_preferences = Counter()
        
        for i, book_id in enumerate(viewed_book_ids):
            if book_id not in viewed_books_map:
                continue
                
            book = viewed_books_map[book_id]
            weight = 1.0 / (i + 1)
            for bc in (book.categories or []):
                category_preferences[bc.categoryId] += weight

        preferred_category_ids = set(category_preferences.keys())

        viewed_embeddings = []
        for bid in viewed_book_ids:
            if bid in self.book_id_to_idx:
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

        SIMILARITY_THRESHOLD = 0.3
        candidates = []
        exclude_ids = set(viewed_book_ids)

        for idx, sim_score in enumerate(similarities):
            bid = self.book_ids[idx]
            if bid in exclude_ids or sim_score < SIMILARITY_THRESHOLD:
                continue
            candidates.append({"book_id": bid, "base_score": float(sim_score)})

        if not candidates:
            similar_indices = similarities.argsort()[::-1]
            for idx in similar_indices[:limit * 3]:
                bid = self.book_ids[idx]
                if bid not in exclude_ids:
                    candidates.append({"book_id": bid, "base_score": float(similarities[idx])})

        if not candidates:
            return []

        candidate_ids = [c["book_id"] for c in candidates]
        candidate_books = await self.db.book.find_many(
            where={"id": {"in": candidate_ids}},
            include={"categories": {"include": {"category": True}}},
        )
        book_info = {b.id: b for b in candidate_books}

        CATEGORY_BOOST = 0.25
        CATEGORY_PENALTY = 0.6

        results = []
        for candidate in candidates:
            bid = candidate["book_id"]
            base_score = candidate["base_score"]
            final_score = base_score

            if bid in book_info:
                book = book_info[bid]
                candidate_category_ids = {bc.categoryId for bc in (book.categories or [])}

                category_overlap = preferred_category_ids & candidate_category_ids
                if category_overlap:
                    boost_factor = sum(
                        category_preferences.get(cid, 0) for cid in category_overlap
                    )
                    max_pref = max(category_preferences.values()) if category_preferences else 1
                    normalized_boost = boost_factor / (max_pref * len(category_overlap))
                    final_score += base_score * CATEGORY_BOOST * min(normalized_boost, 1.0)
                elif preferred_category_ids and candidate_category_ids:
                    final_score *= CATEGORY_PENALTY

            results.append({"book_id": bid, "score": final_score})

        results.sort(key=lambda x: x["score"], reverse=True)

        return results[:limit]
