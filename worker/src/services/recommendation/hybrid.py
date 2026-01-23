"""
Hybrid Recommender
Kết hợp Content-Based và Collaborative Filtering
"""
from typing import List, Dict, Optional
from collections import defaultdict
from src.config import get_db, get_redis
from .content_based import ContentBasedRecommender
from .collaborative import CollaborativeRecommender


class HybridRecommender:
    COLD_START_THRESHOLD = 5

    DEFAULT_WEIGHTS = {
        "content_based": 0.4,
        "collaborative": 0.6,
    }

    def __init__(self, redis_client=None):
        self.db = None
        self.redis = redis_client or get_redis()
        self.content_based = ContentBasedRecommender(self.redis)
        self.collaborative = CollaborativeRecommender(self.redis)
        
    async def _ensure_db(self):
        if self.db is None:
            self.db = get_db()
    
    async def _count_user_interactions(self, user_id: int) -> int:
        """Đếm số interactions của user"""
        await self._ensure_db()
        return await self.db.bookview.count(where={"userId": user_id})
    
    async def get_popular_books(self, limit: int = 10) -> List[Dict]:
        """Fallback: Lấy books phổ biến nhất"""
        await self._ensure_db()
        
        books = await self.db.book.find_many(
            where={"isActive": True, "status": "PUBLISHED"},
            order={"viewCount": "desc"},
            take=limit
        )
        
        max_views = books[0].viewCount if books else 1
        
        return [
            {
                "book_id": book.id,
                "score": book.viewCount / max_views,
                "source": "popular"
            }
            for book in books
        ]
    
    async def get_recommendations(
        self,
        user_id: Optional[int] = None,
        limit: int = 10,
        weights: Optional[Dict[str, float]] = None
    ) -> List[Dict]:
        """Main recommendation method với hybrid approach"""
        weights = weights or self.DEFAULT_WEIGHTS
        
        if user_id is None:
            return await self.get_popular_books(limit)
        
        interaction_count = await self._count_user_interactions(user_id)
        
        if interaction_count == 0:
            return await self.get_popular_books(limit)
        
        if interaction_count < self.COLD_START_THRESHOLD:
            return await self._get_cold_start_recommendations(user_id, limit)
        
        return await self._get_hybrid_recommendations(user_id, limit, weights)
    
    async def _get_cold_start_recommendations(
        self,
        user_id: int,
        limit: int
    ) -> List[Dict]:
        """Cold-start: Kết hợp content-based với popular"""
        content_recs = await self.content_based.get_recommendations_for_user(
            user_id, limit=limit
        )
        
        if len(content_recs) < limit:
            popular = await self.get_popular_books(limit - len(content_recs))
            existing_ids = {r["book_id"] for r in content_recs}
            
            for item in popular:
                if item["book_id"] not in existing_ids:
                    content_recs.append(item)
        
        for rec in content_recs:
            if "source" not in rec:
                rec["source"] = "content_based"
        
        return content_recs[:limit]
    
    async def _get_hybrid_recommendations(
        self,
        user_id: int,
        limit: int,
        weights: Dict[str, float]
    ) -> List[Dict]:
        """Full hybrid: Weighted combination của content-based và collaborative"""
        content_recs = await self.content_based.get_recommendations_for_user(
            user_id, limit=limit * 2
        )
        
        collab_recs = await self.collaborative.get_recommendations(
            user_id, limit=limit * 2
        )
        
        merged = self._merge_recommendations(
            content_recs,
            collab_recs,
            weights,
            limit
        )
        
        return merged
    
    def _merge_recommendations(
        self,
        content_recs: List[Dict],
        collab_recs: List[Dict],
        weights: Dict[str, float],
        limit: int
    ) -> List[Dict]:
        """Merge recommendations từ nhiều sources với weighted scoring"""
        score_map = defaultdict(lambda: {"score": 0, "sources": []})
        
        if content_recs:
            max_score = max(r["score"] for r in content_recs) or 1
            for rec in content_recs:
                book_id = rec["book_id"]
                normalized_score = rec["score"] / max_score
                score_map[book_id]["score"] += normalized_score * weights["content_based"]
                score_map[book_id]["sources"].append("content_based")
        
        if collab_recs:
            max_score = max(r["score"] for r in collab_recs) or 1
            for rec in collab_recs:
                book_id = rec["book_id"]
                normalized_score = rec["score"] / max_score
                score_map[book_id]["score"] += normalized_score * weights["collaborative"]
                if "collaborative" not in score_map[book_id]["sources"]:
                    score_map[book_id]["sources"].append("collaborative")
        
        sorted_items = sorted(
            score_map.items(),
            key=lambda x: x[1]["score"],
            reverse=True
        )
        
        return [
            {
                "book_id": book_id,
                "score": data["score"],
                "sources": data["sources"]
            }
            for book_id, data in sorted_items[:limit]
        ]
    
    async def get_similar_books(
        self,
        book_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """Tìm books tương tự (dùng content-based)"""
        return await self.content_based.get_similar_books(book_id, limit)

    async def compute_similarity_matrix(self):
        """Pre-compute similarity matrix cho collaborative filtering"""
        await self.content_based.build_book_embeddings()
        await self.collaborative.compute_item_similarity()

        return {"status": "completed"}

    async def precompute_user_recommendations(
        self,
        limit: int = 20,
        ttl: int = 86400,
    ) -> Dict:
        """Pre-compute recommendations cho tất cả active users và cache vào Redis"""
        import json

        await self._ensure_db()

        # Lấy tất cả users có interactions
        active_users = await self.db.bookview.find_many(
            where={"userId": {"not": None}},
            distinct=["userId"],
        )

        user_ids = [u.userId for u in active_users if u.userId]
        computed_count = 0

        print(f"Pre-computing recommendations for {len(user_ids)} users...")

        for user_id in user_ids:
            try:
                recs = await self.get_recommendations(user_id, limit=limit)

                if recs:
                    cache_key = f"recommendation:user:{user_id}"
                    self.redis.set(cache_key, json.dumps(recs), ex=ttl)
                    computed_count += 1

            except Exception as e:
                print(f"Failed to compute for user {user_id}: {e}")
                continue

        popular = await self.get_popular_books(limit)
        self.redis.set(
            "recommendation:popular",
            json.dumps(popular),
            ex=ttl,
        )

        print(f"✅ Pre-computed recommendations for {computed_count} users")

        return {
            "status": "completed",
            "users_computed": computed_count,
            "total_users": len(user_ids),
        }

    async def precompute_similar_books(
        self,
        limit: int = 10,
        ttl: int = 86400 * 7,
    ) -> Dict:
        """Pre-compute similar books cho tất cả books và cache vào Redis"""
        import json

        await self._ensure_db()

        books = await self.db.book.find_many(
            where={"isActive": True, "status": "PUBLISHED"},
        )

        computed_count = 0
        print(f"Pre-computing similar books for {len(books)} books...")

        for book in books:
            try:
                similar = await self.get_similar_books(book.id, limit=limit)

                if similar:
                    cache_key = f"recommendation:similar:{book.id}"
                    self.redis.set(cache_key, json.dumps(similar), ex=ttl)
                    computed_count += 1

            except Exception as e:
                print(f"Failed to compute similar for book {book.id}: {e}")
                continue

        print(f"✅ Pre-computed similar books for {computed_count} books")

        return {
            "status": "completed",
            "books_computed": computed_count,
            "total_books": len(books),
        }

    def get_cached_recommendations(self, user_id: int | None) -> List[Dict] | None:
        """Lấy recommendations từ Redis cache"""
        import json

        if user_id is None:
            cache_key = "recommendation:popular"
        else:
            cache_key = f"recommendation:user:{user_id}"

        data = self.redis.get(cache_key)
        if data:
            return json.loads(data)
        return None

    def get_cached_similar_books(self, book_id: int) -> List[Dict] | None:
        """Lấy similar books từ Redis cache"""
        import json

        cache_key = f"recommendation:similar:{book_id}"
        data = self.redis.get(cache_key)
        if data:
            return json.loads(data)
        return None
