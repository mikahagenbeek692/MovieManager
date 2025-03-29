from fastapi import FastAPI
import mysql.connector
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from collections import Counter
from multiprocessing import get_context

app = FastAPI()

DB_CONFIG = {
    "host": "mysql",
    "user": "root",
    "password": "WalramD1!",
    "database": "projectapi"
}

def get_user_watchlist():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    query = """
    SELECT users.id AS user_id, movies.id AS movie_id, movies.title, movies.genre
    FROM watchlists
    JOIN users ON watchlists.user_id = users.id
    JOIN movies ON watchlists.movie_id = movies.id
    """
    cursor.execute(query)
    watchlist_data = cursor.fetchall()
    cursor.close()
    conn.close()
    return pd.DataFrame(watchlist_data)

def get_high_rated_recent_movies():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    query = "SELECT id FROM movies ORDER BY rating DESC, release_year DESC LIMIT 5"
    cursor.execute(query)
    movies = cursor.fetchall()
    cursor.close()
    conn.close()
    return [movie["id"] for movie in movies]

def get_recommendations_from_watchlist(user_id: int, watchlist_df: pd.DataFrame):
    user_watchlist = watchlist_df[watchlist_df["user_id"] == user_id]
    if user_watchlist.empty:
        return []

    genres = []
    for entry in user_watchlist["genre"]:
        if entry:
            genres.extend([g.strip() for g in entry.split(",")])

    if not genres:
        return []

    top_genre = Counter(genres).most_common(1)[0][0]
    watched_ids = user_watchlist["movie_id"].unique().tolist()

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    like_pattern = "%" + top_genre + "%"
    query = "SELECT id FROM movies WHERE genre LIKE %s"
    cursor.execute(query, (like_pattern,))
    movies = cursor.fetchall()
    cursor.close()
    conn.close()

    candidate_ids = [movie["id"] for movie in movies if movie["id"] not in watched_ids]
    return candidate_ids[:5]

def get_similar_user_recommendations(args):
    similar_user_id, target_user_id, watchlist_dict = args
    recommended = []

    df = pd.DataFrame(watchlist_dict)
    similar_user_movies = df[df["user_id"] == similar_user_id]["movie_id"].unique()
    target_user_movies = df[df["user_id"] == target_user_id]["movie_id"].unique()

    for movie_id in similar_user_movies:
        if movie_id not in target_user_movies:
            recommended.append(movie_id)
    return recommended

@app.get("/recommend/{user_id}")
def recommend_movies(user_id: int):
    watchlist_df = get_user_watchlist()

    if watchlist_df.empty:
        return {"recommended_movie_ids": get_high_rated_recent_movies()}

    user_movie_matrix = watchlist_df.pivot_table(
        index="user_id",
        columns="movie_id",
        aggfunc="size",
        fill_value=0
    )

    if user_id not in user_movie_matrix.index:
        return {"recommended_movie_ids": get_high_rated_recent_movies()}

    similarity_matrix = cosine_similarity(user_movie_matrix)
    user_index = user_movie_matrix.index.get_loc(user_id)
    similarity_scores = list(enumerate(similarity_matrix[user_index]))
    top_similar_users = sorted(similarity_scores, key=lambda x: x[1], reverse=True)[1:6]

    args = [
        (user_movie_matrix.index[idx], user_id, watchlist_df.to_dict(orient='records'))
        for idx, _ in top_similar_users
    ]

    with get_context("spawn").Pool(processes=4) as pool:
        results = pool.map(get_similar_user_recommendations, args)

    recommended_movies = list(set(movie for sublist in results for movie in sublist))

    if not recommended_movies:
        recommended_movies = get_recommendations_from_watchlist(user_id, watchlist_df)

    return {"recommended_movie_ids": [int(mid) for mid in recommended_movies]}
