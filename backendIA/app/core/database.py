from mongoengine import Document, StringField, BooleanField, DateTimeField, connect
from datetime import datetime
import enum
from app.core.config import settings


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class User(Document):
    username = StringField(required=True, unique=True, max_length=50)
    email = StringField(required=True, unique=True, max_length=100)
    hashed_password = StringField(required=True)
    role = StringField(choices=[UserRole.USER.value, UserRole.ADMIN.value], default=UserRole.USER.value)
    is_active = BooleanField(default=True)
    created_at = DateTimeField(default=datetime.utcnow)
    
    meta = {
        'collection': 'users',
        'indexes': ['username', 'email']
    }


# Connexion à MongoDB
def connect_db():
    connect(host=settings.database_url)


# Créer les index (équivalent de create_tables pour MongoDB)
def create_tables():
    connect_db()
    # Les index sont créés automatiquement grâce à la meta configuration


# Dependency pour obtenir la session de base de données (pour compatibilité)
def get_db():
    # Pour MongoDB avec MongoEngine, pas besoin de session
    # Cette fonction est gardée pour compatibilité avec FastAPI
    yield None
