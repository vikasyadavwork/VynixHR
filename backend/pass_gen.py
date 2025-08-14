import random
import string
from werkzeug.security import generate_password_hash


# Function to generate a strong password
def generate_strong_password(length=12):
    # Define the characters used for password creation
    characters = string.ascii_letters + string.digits + string.punctuation
    # Randomly choose characters from the available set
    password = "".join(random.choice(characters) for i in range(length))
    return password


# Generate a strong password
password = generate_strong_password()

# Generate a hashed version of the password
hashed_password = generate_password_hash(password)

# Print the results
print(f"Original Password: {password}")
print(f"Hashed Password: {hashed_password}")
