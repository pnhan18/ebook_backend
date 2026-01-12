"""
Celery tasks cho Recommendation System
"""
import asyncio
from src.celery_app import app
from src.services.recommendation import HybridRecommender
from src.config import init_db, close_db


def run_async(coro):
    """Helper to run async code in sync Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@app.task(bind=True, max_retries=3, default_retry_delay=300)
def compute_similarity_matrix(self):
    """
    Pre-compute similarity matrices cho cả content-based và collaborative.
    Nên chạy định kỳ (daily) qua Celery beat.
    
    Usage:
        compute_similarity_matrix.delay()
    """
    try:
        async def _compute():
            await init_db()
            try:
                recommender = HybridRecommender()
                result = await recommender.compute_similarity_matrix()
                return result
            finally:
                await close_db()
        
        result = run_async(_compute())
        print(f"✅ Similarity matrix computed successfully")
        return result
        
    except Exception as e:
        print(f"❌ Failed to compute similarity matrix: {e}")
        raise self.retry(exc=e)


@app.task(bind=True, max_retries=2, default_retry_delay=30)
def get_recommendations(self, user_id: int = None, limit: int = 10):
    """
    Lấy recommendations cho user.
    
    Usage:
        result = get_recommendations.delay(user_id=123, limit=10)
        recommendations = result.get()  # blocking
        
    Hoặc async:
        task = get_recommendations.apply_async(args=[123, 10])
    """
    try:
        async def _get_recs():
            await init_db()
            try:
                recommender = HybridRecommender()
                return await recommender.get_recommendations(user_id, limit)
            finally:
                await close_db()
        
        recommendations = run_async(_get_recs())
        return {
            "user_id": user_id,
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
    except Exception as e:
        print(f"❌ Failed to get recommendations for user {user_id}: {e}")
        raise self.retry(exc=e)


@app.task(bind=True, max_retries=2, default_retry_delay=30)
def get_similar_books(self, book_id: int, limit: int = 10):
    """
    Lấy books tương tự với book_id.

    Usage:
        result = get_similar_books.delay(book_id=456, limit=10)
    """
    try:
        async def _get_similar():
            await init_db()
            try:
                recommender = HybridRecommender()
                return await recommender.get_similar_books(book_id, limit)
            finally:
                await close_db()

        similar = run_async(_get_similar())
        return {
            "book_id": book_id,
            "similar_books": similar,
            "count": len(similar),
        }

    except Exception as e:
        print(f"❌ Failed to get similar books for {book_id}: {e}")
        raise self.retry(exc=e)


@app.task(bind=True, max_retries=3, default_retry_delay=300)
def precompute_all_recommendations(self, limit: int = 20):
    """
    Pre-compute recommendations cho tất cả users và cache vào Redis.
    Nên chạy định kỳ (mỗi vài giờ) qua Celery beat.

    Usage:
        precompute_all_recommendations.delay()
    """
    try:
        async def _precompute():
            await init_db()
            try:
                recommender = HybridRecommender()
                # Compute similarity matrix trước
                await recommender.compute_similarity_matrix()
                # Sau đó pre-compute cho users
                result = await recommender.precompute_user_recommendations(limit=limit)
                return result
            finally:
                await close_db()

        result = run_async(_precompute())
        print(f"✅ Pre-computed recommendations: {result}")
        return result

    except Exception as e:
        print(f"❌ Failed to precompute recommendations: {e}")
        raise self.retry(exc=e)


@app.task(bind=True, max_retries=3, default_retry_delay=300)
def precompute_similar_books(self, limit: int = 10):
    """
    Pre-compute similar books cho tất cả books và cache vào Redis.
    Nên chạy định kỳ (daily hoặc weekly) qua Celery beat.

    Usage:
        precompute_similar_books.delay()
    """
    try:
        async def _precompute():
            await init_db()
            try:
                recommender = HybridRecommender()
                result = await recommender.precompute_similar_books(limit=limit)
                return result
            finally:
                await close_db()

        result = run_async(_precompute())
        print(f"✅ Pre-computed similar books: {result}")
        return result

    except Exception as e:
        print(f"❌ Failed to precompute similar books: {e}")
        raise self.retry(exc=e)


@app.task(bind=True, max_retries=2, default_retry_delay=10)
def compute_user_recommendation(self, user_id: int, limit: int = 20):
    """
    Compute recommendations cho một user cụ thể và cache vào Redis.
    Được trigger khi user đạt ngưỡng interactions (VD: 5 views).

    Usage:
        compute_user_recommendation.delay(user_id=123)
    """
    try:
        import json

        async def _compute():
            await init_db()
            try:
                recommender = HybridRecommender()
                
                # Ensure embeddings are loaded
                await recommender.content_based._ensure_embeddings()
                
                # Get recommendations for this user
                recs = await recommender.get_recommendations(user_id, limit=limit)
                
                if recs:
                    cache_key = f"recommendation:user:{user_id}"
                    recommender.redis.set(cache_key, json.dumps(recs), ex=86400)
                
                return recs
            finally:
                await close_db()

        result = run_async(_compute())
        print(f"✅ Computed recommendations for user {user_id}: {len(result)} items")
        return {
            "user_id": user_id,
            "recommendations": result,
            "count": len(result),
        }

    except Exception as e:
        print(f"❌ Failed to compute recommendations for user {user_id}: {e}")
        raise self.retry(exc=e)
