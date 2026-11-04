import argparse
from datetime import datetime, timedelta, timezone
import os
import random
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.comment import Comment
from app.models.game import Game
from app.models.library import LibraryEntry, LibraryStatus
from app.models.review import Review
from app.models.user import User
from app.services.security import hash_password

DEMO_DOMAIN = "@demo.local"

DEMO_USERNAMES = [
    "pixelpilot",
    "nora_plays",
    "retro_kai",
    "starlight_sam",
    "cloud_strider",
    "valkyrie_v",
    "quest_quinn",
    "cyber_sage",
    "shadow_fox",
    "echo_blade",
    "luna_nova",
    "iron_heart",
    "mystic_monk",
    "cosmic_drifter",
    "amber_glade",
]

REVIEW_SENTENCES = [
    "The world design and atmosphere are absolutely breathtaking.",
    "Combat mechanics feel tight, responsive, and deeply satisfying.",
    "A truly memorable storyline with incredible character development.",
    "The soundtrack elevates every single emotional moment.",
    "Visually stunning with top-notch art direction throughout.",
    "Pacing drags a bit in the middle chapter, but the finale delivers.",
    "Boss fights are challenging yet fair and rewarding to master.",
    "Level design encourages clever exploration and experimentation.",
    "One of the most immersive experiences I have had all year.",
    "Controls took a little getting used to, but everything clicked eventually.",
    "Side quests offer surprisingly thoughtful writing and world-building.",
    "A few minor bugs at launch, though nothing game-breaking.",
    "The voice acting brings every character vividly to life.",
    "Inventory management can feel a bit tedious in longer sessions.",
    "Outstanding visual polish and smooth performance from start to finish.",
    "The progression system feels rewarding without demanding endless grinding.",
    "A masterclass in environmental storytelling and subtle clues.",
    "Multiplayer mode adds great replay value with friends.",
    "User interface is clean, intuitive, and easy to navigate.",
    "The difficulty curve is well balanced for both newcomers and veterans.",
    "Writing and dialogue are witty, sharp, and genuinely entertaining.",
    "The stealth mechanics offer multiple creative routes through each area.",
    "An emotional rollercoaster that kept me hooked until the credits rolled.",
    "Graphics and lighting effects showcase fantastic technical prowess.",
    "Resource gathering can get slightly repetitive toward the late game.",
    "Fast travel and map design make navigating the world a breeze.",
    "Skill trees provide meaningful choices for varied playstyles.",
    "Enemy variety keeps every encounter fresh and unpredictable.",
    "The ending left a profound impression that stayed with me for days.",
    "Platforming sections are snappy, precise, and delightfully tuned.",
    "Lore books and background notes add wonderful depth to the universe.",
    "Cutscenes are cinematic, beautifully directed, and never overstay.",
    "A remarkable blend of classic nostalgia and modern refinement.",
    "Performance stayed rock solid even during chaotic screen moments.",
    "Sound design details like footsteps and ambient wind are top tier.",
    "Could have used a bit more variety in early mission objectives.",
    "Puzzles strike a great balance between cleverness and accessibility.",
    "Replay value is exceptionally high thanks to branching pathways.",
    "A genuinely refreshing take on an established and beloved genre.",
    "An absolute must-play that belongs in every gamer's library.",
    "I simply could not put the controller down until I reached the end.",
    "Fantastic attention to detail in every single room and corner.",
]

COMMENT_POOL = [
    "Completely agree with your breakdown here!",
    "Great review, convinced me to give this game another shot.",
    "Spot on about the soundtrack, it is honestly unforgettable.",
    "I had a similar experience with the pacing around the mid-game.",
    "Thanks for the detailed impressions, very helpful write-up!",
    "The boss fights really were the highlight for me too.",
    "Nice perspective! Did you try playing on the hardest difficulty?",
    "Totally with you on the art style, gorgeous aesthetic.",
    "Interesting take, though I personally enjoyed the second act more.",
    "Couldn't have said it better myself, exceptional game.",
    "Appreciate the honest review, saved me from dropping it too early.",
    "The ending hit me so hard as well, definitely agree.",
    "How long did it take you to complete the main story?",
    "Well written review! Adding this to my wishlist right now.",
    "I struggled with the controls at first too, glad you mentioned that.",
    "The side quests really do deserve all the praise they are getting.",
    "Great summary of what makes this game special.",
    "Did you explore all the secret areas? Some are easily missed!",
    "Agreed on the combat mechanics, super fluid and responsive.",
    "Thanks for sharing your thoughts, excellent review!",
    "I found the inventory system fine, but I understand the critique.",
    "The voice cast did an incredible job across the board.",
    "One of the best games in recent memory, glad you loved it too.",
    "Solid points all around, very fair assessment.",
    "Really helpful review, matches my experience almost word for word.",
    "Such a refreshing experience in this genre, totally agree with you.",
]


def seed_demo_data(
    db: Session,
    password: str | None = None,
    min_games: int = 30,
    reset: bool = False,
) -> dict[str, int]:
    if os.environ.get("APP_ENV") == "production":
        raise RuntimeError("Cannot run demo seed in production environment.")

    if not password:
        password = os.environ.get("DEMO_USER_PASSWORD")
    if not password:
        raise ValueError("DEMO_USER_PASSWORD environment variable is not set.")

    game_count = db.query(func.count(Game.id)).scalar() or 0
    if game_count < min_games:
        raise ValueError(
            f"Database must contain at least {min_games} games (found {game_count}). Run 'python -m scripts.seed_games' first."
        )

    # Check for existing demo users
    existing_demo_users = (
        db.query(User).filter(User.email.ilike(f"%{DEMO_DOMAIN}")).all()
    )

    if existing_demo_users and not reset:
        print("demo data already present")
        demo_user_ids = [u.id for u in existing_demo_users]
        return {
            "users": len(existing_demo_users),
            "entries": (
                db.query(func.count(LibraryEntry.user_id))
                .filter(LibraryEntry.user_id.in_(demo_user_ids))
                .scalar()
                or 0
            ),
            "reviews": (
                db.query(func.count(Review.id))
                .filter(Review.user_id.in_(demo_user_ids))
                .scalar()
                or 0
            ),
            "comments": (
                db.query(func.count(Comment.id))
                .filter(Comment.user_id.in_(demo_user_ids))
                .scalar()
                or 0
            ),
        }

    if reset and existing_demo_users:
        for u in existing_demo_users:
            db.delete(u)
        db.commit()

    rng = random.Random(42)
    pwd_hash = hash_password(password)
    now = datetime.now(timezone.utc)

    # 1. Create 15 users
    users: list[User] = []
    for uname in DEMO_USERNAMES:
        created_at = now - timedelta(
            days=rng.uniform(10, 60), hours=rng.uniform(0, 24)
        )
        u = User(
            username=uname,
            email=f"{uname}{DEMO_DOMAIN}",
            password_hash=pwd_hash,
            created_at=created_at,
        )
        db.add(u)
        users.append(u)
    db.commit()
    for u in users:
        db.refresh(u)

    # 2. Fetch games and partition into top and other
    all_games = (
        db.query(Game)
        .order_by(Game.rawg_rating.desc().nullslast(), Game.id.asc())
        .all()
    )
    top_slice_len = min(15, len(all_games))
    top_games = all_games[:top_slice_len]
    other_games = all_games[top_slice_len:]

    library_entries: list[LibraryEntry] = []
    reviews: list[Review] = []
    reviewed_pairs: set[tuple[int, int]] = set()

    status_choices = [
        LibraryStatus.wishlist,
        LibraryStatus.playing,
        LibraryStatus.completed,
        LibraryStatus.abandoned,
    ]
    status_weights = [0.35, 0.15, 0.35, 0.15]

    # Assign library entries to each user
    for u in users:
        target_count = rng.randint(8, 20)
        num_top = min(len(top_games), rng.randint(min(6, len(top_games)), min(12, len(top_games))))
        chosen_top = rng.sample(top_games, num_top) if top_games else []
        remaining_needed = max(0, target_count - len(chosen_top))
        num_other = min(len(other_games), remaining_needed)
        chosen_other = rng.sample(other_games, num_other) if other_games and num_other > 0 else []
        user_games = chosen_top + chosen_other

        for g in user_games:
            status = rng.choices(status_choices, weights=status_weights)[0]
            max_days = max(1.0, (now - u.created_at).total_seconds() / 86400.0)
            entry_time = u.created_at + timedelta(days=rng.uniform(0.1, max_days))
            if entry_time > now:
                entry_time = now

            entry = LibraryEntry(
                user_id=u.id,
                game_id=g.id,
                status=status,
                updated_at=entry_time,
            )
            library_entries.append(entry)

            # Reviews creation:
            # ~60% of completed/abandoned entries get a review
            # Also ensure top 6 games get high review counts (>= 3) across users
            is_top_game = g in top_games[:8]
            should_review = False
            if status in (LibraryStatus.completed, LibraryStatus.abandoned):
                should_review = rng.random() < 0.60 or is_top_game
            elif is_top_game and rng.random() < 0.35:
                should_review = True
            elif rng.random() < 0.05:
                should_review = True

            pair = (u.id, g.id)
            if should_review and pair not in reviewed_pairs:
                reviewed_pairs.add(pair)
                if status == LibraryStatus.completed:
                    score = rng.choices([6, 7, 8, 9, 10], weights=[0.10, 0.20, 0.40, 0.20, 0.10])[0]
                elif status == LibraryStatus.abandoned:
                    score = rng.choices([2, 3, 4, 5, 6], weights=[0.20, 0.30, 0.30, 0.10, 0.10])[0]
                else:
                    score = rng.choices([6, 7, 8, 9], weights=[0.25, 0.35, 0.25, 0.15])[0]

                # Body: pool of sentences, ~15% have no body
                if rng.random() < 0.15:
                    body = None
                else:
                    sentence_count = rng.randint(1, 3)
                    body = " ".join(rng.sample(REVIEW_SENTENCES, sentence_count))

                rev_time = now - timedelta(days=rng.uniform(0.5, 30))
                if rev_time < u.created_at:
                    rev_time = u.created_at + timedelta(hours=rng.uniform(1, 12))
                if rev_time > now:
                    rev_time = now
                upd_time = rev_time + timedelta(hours=rng.uniform(0, 12))
                if upd_time > now:
                    upd_time = now

                rev = Review(
                    user_id=u.id,
                    game_id=g.id,
                    score=score,
                    body=body,
                    created_at=rev_time,
                    updated_at=upd_time,
                )
                reviews.append(rev)

    db.add_all(library_entries)
    db.add_all(reviews)
    db.commit()

    for r in reviews:
        db.refresh(r)

    # 4. Comments: ~120 comments on random reviews from other users
    comments: list[Comment] = []
    target_comments = min(120, len(reviews) * 4)
    if reviews and len(users) > 1:
        for _ in range(target_comments):
            rev = rng.choice(reviews)
            eligible_commenters = [u for u in users if u.id != rev.user_id]
            commenter = rng.choice(eligible_commenters)
            comment_body = rng.choice(COMMENT_POOL)

            comment_time = rev.created_at + timedelta(hours=rng.uniform(1, 72))
            if comment_time > now:
                comment_time = now - timedelta(minutes=rng.uniform(1, 60))

            c = Comment(
                review_id=rev.id,
                user_id=commenter.id,
                body=comment_body,
                created_at=comment_time,
            )
            comments.append(c)

        db.add_all(comments)
        db.commit()

    summary = {
        "users": len(users),
        "entries": len(library_entries),
        "reviews": len(reviews),
        "comments": len(comments),
    }

    print(
        f"Seeded demo data: {summary['users']} users, "
        f"{summary['entries']} library entries, "
        f"{summary['reviews']} reviews, "
        f"{summary['comments']} comments"
    )

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data for local development")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset existing demo users and reseed",
    )
    args = parser.parse_args()

    if os.environ.get("APP_ENV") == "production":
        print("Error: Cannot run demo seed in production environment.", file=sys.stderr)
        sys.exit(1)

    password = os.environ.get("DEMO_USER_PASSWORD")
    if not password:
        print("Error: DEMO_USER_PASSWORD environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    with SessionLocal() as db:
        try:
            seed_demo_data(db, password=password, min_games=30, reset=args.reset)
        except ValueError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
