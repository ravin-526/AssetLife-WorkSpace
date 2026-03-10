from app.db.mongo import get_db, get_mongo_manager

mongo_manager = get_mongo_manager()


def get_database():
	return get_db()
