CREATE TABLE bookmarks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    event_id INT,
    FOREIGN KEY (user_id) REFERENCES user(uid),
    FOREIGN KEY (event_id) REFERENCES event(eid)
);