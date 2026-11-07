from sqlalchemy import text

from app.database import engine


def main() -> None:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1")).scalar_one()
    print(f"Database connection successful: SELECT {result}")


if __name__ == "__main__":
    main()
