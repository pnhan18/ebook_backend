import redis
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from redis.exceptions import ConnectionError, TimeoutError
from .settings import REDIS_URL

_redis_client = None


def get_redis() -> redis.Redis:
    global _redis_client
    
    if _redis_client is None:
        retry = Retry(
            backoff=ExponentialBackoff(cap=10, base=1),
            retries=3,
            supported_errors=(ConnectionError, TimeoutError),
        )
        
        # Connection pool config
        pool = redis.ConnectionPool.from_url(
            REDIS_URL,
            max_connections=10,
            retry_on_timeout=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            health_check_interval=30,
        )
        
        _redis_client = redis.Redis(
            connection_pool=pool,
            retry=retry,
            decode_responses=False,
        )
        
        # Test connection
        try:
            _redis_client.ping()
        except (ConnectionError, TimeoutError) as e:
            print(f"⚠️ Redis connection failed: {e}")
            _redis_client = None
            raise
    
    return _redis_client


def close_redis():
    """Close Redis connection pool"""
    global _redis_client
    if _redis_client is not None:
        _redis_client.close()
        _redis_client = None


def is_redis_available() -> bool:
    """Check if Redis is available"""
    try:
        client = get_redis()
        return client.ping()
    except Exception:
        return False
