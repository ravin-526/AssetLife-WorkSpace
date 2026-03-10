from functools import lru_cache

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.core.config import settings


class MongoManager:
    def __init__(self) -> None:
        self._client: AsyncIOMotorClient | None = None
        self._database: AsyncIOMotorDatabase | None = None

    async def connect(self) -> None:
        if self._client is None:
            self._client = AsyncIOMotorClient(settings.MONGODB_URI)
            self._database = self._client[settings.MONGODB_DB]

    async def disconnect(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
            self._database = None

    def get_database(self) -> AsyncIOMotorDatabase:
        if self._database is None:
            raise RuntimeError("MongoDB is not connected")
        return self._database

    def get_collection(self, name: str) -> AsyncIOMotorCollection:
        return self.get_database()[name]


@lru_cache(maxsize=1)
def get_mongo_manager() -> MongoManager:
    return MongoManager()


def get_db() -> AsyncIOMotorDatabase:
    return get_mongo_manager().get_database()
