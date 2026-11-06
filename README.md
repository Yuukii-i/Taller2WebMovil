# TEMPORARY: project status (delete this section before the final delivery)

Done so far:
- Database schema (users, games, genres, library entries, reviews, comments) with Alembic migrations.
- Backend API: register/login/logout with JWT, games and genres, IGDB import, library statuses, reviews, comments and the home page lists. Backend tests pass.
- Seed scripts: one for games (from IGDB) and one for demo users, reviews and comments.
- Frontend: app shell with toolbar and mobile menu, login and register pages, home page (hero carousel, welcome strip and showcase lists), browse and search page, game detail page, review page with comments, and the user profile page.

Still left:
- Get the IGDB credentials (Twitch Client ID and Client Secret) and run the game seed.
- Test every page by hand in the browser, also at phone width (around 360 px).
- Final visual polish: spacing, empty states, small mobile issues.
- Cache IGDB searches in the backend so the same search does not use API requests every time.
- Make `seed_demo.py` read `DEMO_USER_PASSWORD` from the `.env` file (right now it only reads a normal environment variable, see step 6).
- Choose the final name of the site (it is a placeholder called "site" in `frontend/src/app/site.config.ts`).
- Check everything again against the course requirements list.
- Add the team names below and delete this section.

---

# Game Tracking Website

Web application where users keep track of the games they play. Each user can mark a game as wishlist, playing, completed or abandoned, write a review with a score from 1 to 10, and comment on the reviews of other users. The home page shows lists such as the best rated games, the most wishlisted ones and the most abandoned ones.

Team: (add names here)

## Features

- Register, login and logout (JWT authentication, passwords stored hashed).
- Home page with a hero carousel and lists: top rated, most wishlisted, most played right now, most completed, most abandoned and recent reviews.
- Browse and search games, filter by genre and sort by rating, title, release date or number of reviews.
- Game page with description, genres, platforms, average score and how many users have it in each status.
- Library: add a game to your wishlist, mark it as playing, completed or abandoned.
- Reviews: one review per user and game, with a score from 1 to 10 and an optional text. Can be edited and deleted.
- Comments on reviews. The comment author or the review author can delete a comment.
- User profile with the library split by status and the list of reviews.
- Works on desktop and mobile.

## Technologies

Backend
- Python
- FastAPI (REST API, JSON)
- SQLAlchemy 2 (ORM) and Alembic (database migrations)
- psycopg 3 (PostgreSQL driver)
- Pydantic and pydantic-settings (validation and configuration)
- PyJWT (tokens) and pwdlib with argon2 (password hashing)
- httpx (requests to IGDB)
- Uvicorn (server) and pytest (tests)

Frontend
- Angular (standalone components, Router, Signals, httpResource, Reactive Forms)
- Angular Material and Angular CDK
- TypeScript, HTML and SCSS (CSS)
- RxJS
- Vitest (unit tests)
- Fonts: Inter and Playfair Display (Google Fonts)

Database
- PostgreSQL 16, run with Docker Compose

External data
- IGDB API (https://api-docs.igdb.com) is used as the game database. Games are imported from IGDB into our own PostgreSQL database, so the site reads them from there. Game data and images come from IGDB.

## Project structure

```
backend/
  app/            FastAPI app (routers, models, schemas, services)
  alembic/        database migrations
  scripts/        seed_games.py and seed_demo.py
  tests/          pytest tests
frontend/
  src/app/        Angular app (pages, components, services, guards, interceptors)
docker-compose.yml
.env.example
```

## Requirements

- Docker Desktop (for the database)
- Python 3.12 or newer (we used 3.14)
- Node.js 22 or newer and npm (we used Node 24)
- Twitch developer credentials (Client ID and Client Secret) for IGDB (https://api-docs.igdb.com)

## How to run it

The commands are for PowerShell on Windows. On macOS or Linux, activate the virtual environment with `source .venv/bin/activate` instead.

You need three things running at the same time: the database, the backend and the frontend. Use one terminal for each.

### 1. Clone the repository

```
git clone https://github.com/Yuukii-i/Taller2WebMovil.git
cd Taller2WebMovil
```

### 2. Create the .env file

Copy the example file in the root folder of the project:

```
copy .env.example .env
```

Then open `.env` and set the values:

- `POSTGRES_PASSWORD`: any password you want for the database. Use the same password inside `DATABASE_URL`.
- `JWT_SECRET`: a long random text, at least 32 characters. You can generate one with:
  ```
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
- `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`: your Twitch developer credentials for IGDB (https://dev.twitch.tv/console/apps).
- The other values can stay as they are.

The `.env` file is ignored by git, never upload it.

### 3. Start the database

Open Docker Desktop and wait until it is running, then:

```
docker compose up -d db
```

Check that the container `web_movil_db` is up with `docker ps`.

### 4. Set up and start the backend

In a new terminal:

```
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The API runs at http://localhost:8000 and the interactive documentation is at http://localhost:8000/docs.

If PowerShell does not let you activate the environment, run this once and try again:

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 5. Import the games

In another terminal, with the virtual environment active (the prompt starts with `(.venv)`):

```
cd backend
.venv\Scripts\Activate.ps1
python -m scripts.seed_games
```

This downloads about 300 popular games from IGDB and saves them in the database. It takes about a minute and can be run again without creating duplicates. It needs `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` from step 2.

### 6. Optional: demo data

To see the site with users, reviews and comments, create the demo data. The password for the demo accounts is read from an environment variable of the terminal (not from `.env`):

```
$env:DEMO_USER_PASSWORD = "choose-a-password"
python -m scripts.seed_demo
```

This creates 15 demo users with library entries, reviews and comments. You can log in with any of them, for example the username `pixelpilot` and the password you chose. To delete and create the demo data again use `python -m scripts.seed_demo --reset`. Only the demo users (emails ending in `@demo.local`) are affected.

### 7. Start the frontend

In a third terminal:

```
cd frontend
npm install
npm start
```

Open http://localhost:4200 in the browser. The first time it can take a little while to compile. The terminal stays busy while the server is running, that is normal.

### Stopping everything

Press Ctrl+C in the backend and frontend terminals. To stop the database run `docker compose stop`. The data is kept in a Docker volume, so it is still there the next time.

## Tests

Backend (the database container must be running, the tests use a separate database called `<POSTGRES_DB>_test` that is created automatically):

```
cd backend
.venv\Scripts\Activate.ps1
pytest -q
```

Frontend:

```
cd frontend
npm test
```

## API overview

All routes start with `/api`. Routes marked with (login) need the `Authorization: Bearer <token>` header. The full list is in the Swagger page at `/docs`.

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` (login), `GET /users/me` (login)
- Games: `GET /games`, `GET /games/{id}`, `GET /genres`
- Library: `PUT /library/{game_id}` (login), `DELETE /library/{game_id}` (login), `GET /users/{username}/library`
- Reviews: `GET /games/{id}/reviews`, `POST /games/{id}/reviews` (login), `GET /reviews/{id}`, `PUT /reviews/{id}` (login), `DELETE /reviews/{id}` (login), `GET /users/{username}/reviews`
- Comments: `GET /reviews/{id}/comments`, `POST /reviews/{id}/comments` (login), `DELETE /comments/{id}` (login)
- Home: `GET /home`

## Notes

- The token is saved in the browser's localStorage. It is fine for a university project, but a production site should use something safer.
- If IGDB is not available, the site keeps working with the games already saved in the database. Only searching for games that were never imported needs IGDB.
- Do not commit the `.env` file. Only `.env.example` is in the repository, with placeholder values.

## Common problems

- The backend cannot connect to the database: Docker is not running, or the password in `DATABASE_URL` is different from `POSTGRES_PASSWORD`. The database password is set the first time the container is created. If you change it later, run `docker compose down -v` (this deletes the database data) and start again from step 3.
- `No module named scripts`: the command was run outside the `backend` folder or without the virtual environment active.
- The page opens but shows no games: the backend is not running, or the games were not imported (step 5).
- You were logged out after changing `JWT_SECRET`: the old tokens are not valid anymore, just log in again.

## Credits

Game data and images: IGDB (https://www.igdb.com).
