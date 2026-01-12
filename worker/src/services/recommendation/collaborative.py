"""
Collaborative Filtering
Đề xuất dựa trên hành vi của users tương tự (Item-based CF)
Kết hợp: Views (implicit) + Favorites (implicit) + Ratings (explicit)
"""
import numpy as np
import pickle
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from src.config import get_db, get_redis


class CollaborativeRecommender:
    # Weights cho các loại interaction
    INTERACTION_WEIGHTS = {
        "view": 0.2,      # Implicit - yếu nhất
        "favorite": 0.3,  # Implicit - mạnh hơn view
        "rating": 0.5,    # Explicit - mạnh nhất
    }

    def __init__(self, redis_client=None):
        self.db = None
        self.redis = redis_client or get_redis()
        self.item_similarity_matrix = None
        self.book_id_to_idx = {}
        self.idx_to_book_id = {}

    async def _ensure_db(self):
        if self.db is None:
            self.db = get_db()

    async def _build_user_item_matrix(self) -> Tuple[csr_matrix, Dict, Dict]:
        """
        Xây dựng user-item interaction matrix từ:
        - BookView (implicit)
        - Favorite (implicit)
        - Rating (explicit)
        
        Sử dụng asyncio.gather để query song song, tăng performance.
        """
        await self._ensure_db()
        import asyncio

        # Query song song 3 bảng
        views_task = self.db.bookview.find_many(
            where={"userId": {"not": None}}
        )
        favorites_task = self.db.favorite.find_many()
        ratings_task = self.db.rating.find_many()

        views, favorites, ratings = await asyncio.gather(
            views_task, favorites_task, ratings_task
        )

        # Thu thập tất cả interactions
        user_book_scores = defaultdict(lambda: defaultdict(float))
        all_users = set()
        all_books = set()

        # 1. Process Views (implicit feedback)
        view_counts = defaultdict(lambda: defaultdict(int))
        for view in views:
            view_counts[view.userId][view.bookId] += 1
            all_users.add(view.userId)
            all_books.add(view.bookId)

        # Normalize view counts và add to scores
        for user_id, books in view_counts.items():
            if books:
                max_views = max(books.values())
                for book_id, count in books.items():
                    normalized = np.log1p(count) / np.log1p(max_views)
                    user_book_scores[user_id][book_id] += (
                        normalized * self.INTERACTION_WEIGHTS["view"]
                    )

        # 2. Process Favorites (implicit feedback - stronger signal)
        for fav in favorites:
            all_users.add(fav.userId)
            all_books.add(fav.bookId)
            user_book_scores[fav.userId][fav.bookId] += (
                1.0 * self.INTERACTION_WEIGHTS["favorite"]
            )

        # 3. Process Ratings (explicit feedback - strongest signal)
        for rating in ratings:
            all_users.add(rating.userId)
            all_books.add(rating.bookId)
            # Normalize rating 1-5 to 0-1
            normalized_rating = (rating.score - 1) / 4.0
            user_book_scores[rating.userId][rating.bookId] += (
                normalized_rating * self.INTERACTION_WEIGHTS["rating"]
            )

        if not all_users or not all_books:
            return None, {}, {}

        # Tạo mappings
        user_id_to_idx = {uid: idx for idx, uid in enumerate(sorted(all_users))}
        book_id_to_idx = {bid: idx for idx, bid in enumerate(sorted(all_books))}
        idx_to_book_id = {idx: bid for bid, idx in book_id_to_idx.items()}

        # Build sparse matrix
        rows, cols, data = [], [], []

        for user_id, books in user_book_scores.items():
            user_idx = user_id_to_idx[user_id]
            for book_id, score in books.items():
                book_idx = book_id_to_idx[book_id]
                rows.append(user_idx)
                cols.append(book_idx)
                data.append(score)

        matrix = csr_matrix(
            (data, (rows, cols)),
            shape=(len(all_users), len(all_books))
        )

        return matrix, book_id_to_idx, idx_to_book_id

    async def compute_item_similarity(self) -> Dict[int, Dict[int, float]]:
        """
        Tính item-item similarity matrix
        Nên chạy định kỳ (batch job) và cache kết quả
        """
        matrix, self.book_id_to_idx, self.idx_to_book_id = (
            await self._build_user_item_matrix()
        )

        if matrix is None:
            return {}

        # Transpose để có item-user matrix
        item_user_matrix = matrix.T

        # Tính cosine similarity giữa các items
        similarity = cosine_similarity(item_user_matrix)

        # Chuyển thành dict để dễ lookup
        similarity_dict = {}

        for idx, book_id in self.idx_to_book_id.items():
            similar_items = {}
            for other_idx, other_book_id in self.idx_to_book_id.items():
                if idx != other_idx and similarity[idx, other_idx] > 0.01:
                    similar_items[other_book_id] = float(similarity[idx, other_idx])

            # Chỉ giữ top 50 similar items
            sorted_items = sorted(
                similar_items.items(), key=lambda x: x[1], reverse=True
            )[:50]
            similarity_dict[book_id] = dict(sorted_items)

        self.item_similarity_matrix = similarity_dict

        # Cache to Redis nếu có
        if self.redis:
            await self._cache_similarity_matrix(similarity_dict)

        return similarity_dict

    async def _cache_similarity_matrix(self, matrix: Dict):
        """Cache similarity matrix to Redis using pickle"""
        if self.redis:
            self.redis.set(
                "recommendation:item_similarity",
                pickle.dumps(matrix),
                ex=86400,  # 24 hours
            )

    async def _load_similarity_matrix(self) -> Optional[Dict]:
        """Load similarity matrix from Redis using pickle"""
        if self.redis:
            data = self.redis.get("recommendation:item_similarity")
            if data:
                return pickle.loads(data)
        return None

    async def _get_user_interactions(self, user_id: int) -> Dict[int, float]:
        """
        Lấy tất cả interactions của user với weighted scores.
        Sử dụng asyncio.gather để query song song.
        """
        await self._ensure_db()
        import asyncio

        user_scores = defaultdict(float)

        # Query song song
        views_task = self.db.bookview.find_many(where={"userId": user_id})
        favorites_task = self.db.favorite.find_many(where={"userId": user_id})
        ratings_task = self.db.rating.find_many(where={"userId": user_id})

        views, favorites, ratings = await asyncio.gather(
            views_task, favorites_task, ratings_task
        )

        # Process views
        view_counts = defaultdict(int)
        for view in views:
            view_counts[view.bookId] += 1

        if view_counts:
            max_views = max(view_counts.values())
            for book_id, count in view_counts.items():
                normalized = np.log1p(count) / np.log1p(max_views)
                user_scores[book_id] += normalized * self.INTERACTION_WEIGHTS["view"]

        # Process favorites
        for fav in favorites:
            user_scores[fav.bookId] += 1.0 * self.INTERACTION_WEIGHTS["favorite"]

        # Process ratings
        for rating in ratings:
            normalized_rating = (rating.score - 1) / 4.0
            user_scores[rating.bookId] += (
                normalized_rating * self.INTERACTION_WEIGHTS["rating"]
            )

        return dict(user_scores)

    async def get_recommendations(
        self,
        user_id: int,
        limit: int = 10,
    ) -> List[Dict]:
        """
        Đề xuất cho user dựa trên Item-based CF
        Score = Σ (similarity(i,j) * user_interaction(j)) cho mỗi item i
        """
        await self._ensure_db()

        # Load similarity matrix
        if self.item_similarity_matrix is None:
            self.item_similarity_matrix = await self._load_similarity_matrix()

        if not self.item_similarity_matrix:
            return []

        # Lấy user's weighted interactions
        user_interactions = await self._get_user_interactions(user_id)

        if not user_interactions:
            return []

        interacted_books = set(user_interactions.keys())

        # Tính score cho mỗi candidate item
        scores = defaultdict(float)

        for book_id, interaction_score in user_interactions.items():
            if book_id not in self.item_similarity_matrix:
                continue

            similar_items = self.item_similarity_matrix[book_id]

            for candidate_id, similarity in similar_items.items():
                if candidate_id not in interacted_books:
                    scores[candidate_id] += similarity * interaction_score

        # Sort và return top items
        sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)

        return [
            {"book_id": book_id, "score": score}
            for book_id, score in sorted_scores[:limit]
        ]

    async def get_similar_users_recommendations(
        self,
        user_id: int,
        limit: int = 10,
    ) -> List[Dict]:
        """
        User-based CF: Tìm users tương tự và recommend những gì họ thích
        Dựa trên tất cả interactions (views, favorites, ratings)
        """
        await self._ensure_db()

        # Lấy user's interacted books
        user_interactions = await self._get_user_interactions(user_id)

        if not user_interactions:
            return []

        user_books = set(user_interactions.keys())

        # Tìm users có interactions với cùng books
        # Ưu tiên users có ratings/favorites giống nhau
        similar_user_scores = defaultdict(float)

        # Check ratings overlap (strongest signal)
        user_ratings = await self.db.rating.find_many(
            where={"userId": user_id}
        )
        user_rated_books = {r.bookId: r.score for r in user_ratings}

        if user_rated_books:
            other_ratings = await self.db.rating.find_many(
                where={
                    "bookId": {"in": list(user_rated_books.keys())},
                    "userId": {"not": user_id},
                }
            )
            for rating in other_ratings:
                # Bonus nếu rating tương tự (cùng thích hoặc cùng không thích)
                user_score = user_rated_books.get(rating.bookId, 3)
                score_diff = abs(user_score - rating.score)
                similarity = 1 - (score_diff / 4.0)  # 0-1
                similar_user_scores[rating.userId] += similarity * 2

        # Check favorites overlap
        user_favorites = await self.db.favorite.find_many(
            where={"userId": user_id}
        )
        user_fav_books = {f.bookId for f in user_favorites}

        if user_fav_books:
            other_favorites = await self.db.favorite.find_many(
                where={
                    "bookId": {"in": list(user_fav_books)},
                    "userId": {"not": user_id},
                }
            )
            for fav in other_favorites:
                similar_user_scores[fav.userId] += 1.5

        # Check views overlap
        other_views = await self.db.bookview.find_many(
            where={
                "bookId": {"in": list(user_books)},
                "userId": {"not": user_id},
            }
        )
        for view in other_views:
            if view.userId:
                similar_user_scores[view.userId] += 0.5

        if not similar_user_scores:
            return []

        # Lấy top similar users
        similar_users = sorted(
            similar_user_scores.items(), key=lambda x: x[1], reverse=True
        )[:30]
        similar_user_ids = [uid for uid, _ in similar_users]

        # Lấy books mà similar users thích nhưng user chưa interact
        candidate_scores = defaultdict(float)

        # Ưu tiên books được rate cao bởi similar users
        candidate_ratings = await self.db.rating.find_many(
            where={
                "userId": {"in": similar_user_ids},
                "bookId": {"notIn": list(user_books)},
                "score": {"gte": 4},  # Chỉ lấy ratings >= 4
            }
        )
        for rating in candidate_ratings:
            user_sim = similar_user_scores.get(rating.userId, 0)
            candidate_scores[rating.bookId] += user_sim * rating.score / 5.0

        # Thêm favorites của similar users
        candidate_favorites = await self.db.favorite.find_many(
            where={
                "userId": {"in": similar_user_ids},
                "bookId": {"notIn": list(user_books)},
            }
        )
        for fav in candidate_favorites:
            user_sim = similar_user_scores.get(fav.userId, 0)
            candidate_scores[fav.bookId] += user_sim * 0.8

        sorted_books = sorted(
            candidate_scores.items(), key=lambda x: x[1], reverse=True
        )

        return [
            {"book_id": book_id, "score": score}
            for book_id, score in sorted_books[:limit]
        ]
