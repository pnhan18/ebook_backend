#!/usr/bin/env python3
"""
Script chạy scheduled recommendation tasks.
Dùng với Azure Container Apps Jobs.

Usage:
    python run_scheduled_recommendation.py
"""
import asyncio
import sys
from src.config import init_db, close_db
from src.services.recommendation import HybridRecommender


async def main():
    print("🚀 Starting scheduled recommendation...")
    
    await init_db()
    try:
        r = HybridRecommender()
        
        print("📊 Computing similarity matrix...")
        await r.compute_similarity_matrix()
        
        print("👥 Precomputing user recommendations...")
        await r.precompute_user_recommendations(20)
        
        print("📚 Precomputing similar books...")
        await r.precompute_similar_books(10)
        
        print("✅ Done!")
    finally:
        await close_db()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
