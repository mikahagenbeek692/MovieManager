-- ========================================
-- Project: Movie Manager
-- Author: Mikah Hagenbeek
-- File: seed.sql
-- Description: Initializes schema and populates movies and a test user
-- ========================================

-- Create Database
CREATE DATABASE IF NOT EXISTS projectapi;
USE projectapi;

-- ========== Drop existing tables (optional for dev/testing) ==========
-- Be careful using this in production!
DROP TABLE IF EXISTS friend_requests, friends, watchlists, users, movies;

-- ========== Users ==========
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    favorite_genres VARCHAR(255),
    BIO TEXT,
    publicity ENUM('private', 'public', 'friendsonly') DEFAULT 'private'
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ========== Movies ==========
CREATE TABLE movies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    release_year YEAR NOT NULL,
    genre VARCHAR(255),
    director VARCHAR(255),
    cast TEXT,
    duration INT,
    rating DECIMAL(3,1),
    description TEXT
);

CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movies_genre ON movies(genre);

-- ========== Watchlists ==========
CREATE TABLE watchlists (
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    watched BOOLEAN DEFAULT FALSE,
    favorite BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, movie_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_movie_id ON watchlists(movie_id);

-- ========== Friends ==========
CREATE TABLE friends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id)
);

-- ========== Friend Requests ==========
CREATE TABLE friend_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request (sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver_id ON friend_requests(receiver_id);

-- ========== Sample User ==========
-- Sample Users (password: test1234)

INSERT INTO users (username, password_hash, email, favorite_genres, BIO, publicity) VALUES
('john_doe', '$2a$14$UGrZZZQzThpiGBM2.NhBNO3Hl6/sI5iQCK/WBWeoxEGOUSqzN6L7u', 'john@example.com', 'Action, Thriller', 'Love classic action films and thrillers.', 'public'),
('jane_smith', '$2a$14$UGrZZZQzThpiGBM2.NhBNO3Hl6/sI5iQCK/WBWeoxEGOUSqzN6L7u', 'jane@example.com', 'Romance, Drama', 'Hopeless romantic and film buff.', 'friendsonly'),
('michael_lee', '$2a$14$UGrZZZQzThpiGBM2.NhBNO3Hl6/sI5iQCK/WBWeoxEGOUSqzN6L7u', 'michael@example.com', 'Sci-Fi, Adventure', 'Space, tech, and time travel fascinate me.', 'private'),
('sarah_khan', '$2a$14$UGrZZZQzThpiGBM2.NhBNO3Hl6/sI5iQCK/WBWeoxEGOUSqzN6L7u', 'sarah@example.com', 'Comedy, Animation', 'Feel-good movies are my thing.', 'public'),
('emily_chen', '$2a$14$UGrZZZQzThpiGBM2.NhBNO3Hl6/sI5iQCK/WBWeoxEGOUSqzN6L7u', 'emily@example.com', 'Mystery, Horror', 'Always hunting the next spine-tingler.', 'friendsonly');


-- ========== Sample Movies ==========
INSERT INTO movies (title, release_year, genre, director, cast, duration, rating, description)
VALUES
('Inception', 2010, 'Science Fiction, Thriller', 'Christopher Nolan', 'Leonardo DiCaprio, Joseph Gordon-Levitt, Ellen Page', 148, 8.8, 'A thief who steals corporate secrets through dream-sharing technology.'),
('The Shawshank Redemption', 1994, 'Drama', 'Frank Darabont', 'Tim Robbins, Morgan Freeman, Bob Gunton', 142, 9.3, 'Two imprisoned men bond over years, finding redemption.'),
('The Dark Knight', 2008, 'Action, Crime, Drama', 'Christopher Nolan', 'Christian Bale, Heath Ledger, Aaron Eckhart', 152, 9.0, 'Batman faces Joker, pushing him to his limits.'),
('Interstellar', 2014, 'Adventure, Drama, Science Fiction', 'Christopher Nolan', 'Matthew McConaughey, Anne Hathaway, Jessica Chastain', 169, 8.6, 'Explorers travel through a wormhole for humanity’s survival.'),
('Pulp Fiction', 1994, 'Crime, Drama', 'Quentin Tarantino', 'John Travolta, Uma Thurman, Samuel L. Jackson', 154, 8.9, 'Crime tales intertwined with violence and redemption.'),
('The Godfather', 1972, 'Crime, Drama', 'Francis Ford Coppola', 'Marlon Brando, Al Pacino, James Caan', 175, 9.2, 'Mafia boss passes control to his reluctant son.'),
('The Matrix', 1999, 'Action, Science Fiction', 'Wachowski Sisters', 'Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss', 136, 8.7, 'A hacker discovers reality is a simulation.'),
('Forrest Gump', 1994, 'Drama, Romance', 'Robert Zemeckis', 'Tom Hanks, Robin Wright, Gary Sinise', 142, 8.8, 'A slow-witted man witnesses major historical events.'),
('Fight Club', 1999, 'Drama', 'David Fincher', 'Brad Pitt, Edward Norton', 139, 8.8, 'A man forms a fight club that spirals out of control.'),
('The Lord of the Rings: The Return of the King', 2003, 'Adventure, Fantasy', 'Peter Jackson', 'Elijah Wood, Ian McKellen', 201, 9.0, 'The final battle for Middle-Earth ensues.');

INSERT INTO movies (id, title, release_year, genre, director, cast, duration, rating, description) VALUES
('The Grand Budapest Hotel', 2014, 'Comedy', 'Wes Anderson', 'Ralph Fiennes, Tony Revolori, Adrien Brody', 99, 8.1, 'A quirky concierge and his apprentice are embroiled in a murder mystery.'),
('Mad Max: Fury Road', 2015, 'Action', 'George Miller', 'Tom Hardy, Charlize Theron, Nicholas Hoult', 120, 8.1, 'In a post-apocalyptic wasteland, two rebels take on a tyrannical ruler.'),
('The Irishman', 2019, 'Drama', 'Martin Scorsese', 'Robert De Niro, Al Pacino, Joe Pesci', 209, 7.8, 'A mob hitman recounts his involvement in key historical events.'),
('Moana', 2016, 'Animation', 'Ron Clements', 'Auli\i Cravalho, Dwayne Johnson, Rachel House', 107, 7.6, 'A Polynesian girl sets out on a daring journey to save her people.'),
('Ford v Ferrari', 2019, 'Drama', 'James Mangold', 'Matt Damon, Christian Bale, Jon Bernthal', 152, 8.1, 'A team of engineers and drivers build a revolutionary race car for Ford.'),
('The Social Network', 2010, 'Biography', 'David Fincher', 'Jesse Eisenberg, Andrew Garfield, Justin Timberlake', 120, 7.8, 'The story of Facebook’s creation and the legal battles surrounding it.'),
('A Quiet Place', 2018, 'Horror', 'John Krasinski', 'Emily Blunt, John Krasinski, Millicent Simmonds', 90, 7.5, 'A family struggles to survive in silence while hiding from alien predators.'),
('Inside Out', 2015, 'Animation', 'Pete Docter', 'Amy Poehler, Phyllis Smith, Bill Hader', 95, 8.1, 'A young girl’s emotions guide her through life-changing events.'),
('Blade Runner 2049', 2017, 'Sci-Fi', 'Denis Villeneuve', 'Ryan Gosling, Harrison Ford, Ana de Armas', 164, 8.0, 'A young blade runner discovers a secret that could alter society forever.');

