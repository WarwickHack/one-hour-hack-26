
from function.whack import whack
from function.verbs import get_random_verb
from function.adjective import get_random_adjective
from function.email import send_email

# Get recipient details
print("Welcome to Bedtime Poems!")
name = input("Who is this poem for? ")
email = input("What is their email address? ")

# Generate the poem
words = whack()
length = len(words)
verbs = get_random_verb(length)
adjs = get_random_adjective(length)

print("\nDear " + name + ",\n")

if length <= 25:
    print("Your short bedtime poem:\n")
elif length <= 75:
    print("Your bedtime poem:\n")
else:
    print("Your looong bedtime poem:\n")

poem_lines = []

for i in range(length):
    word = words[i]
    verb = verbs[i]
    adj = adjs[i].capitalize()

    line = f"{adj} {word} {verb},"
    poem_lines.append(line)
    print(line)

poem_lines.append("")
poem_lines.append("Good night!")

print("\nGood night!")

# Combine poem into one string
poem = f"Dear {name},\n\n" + "\n".join(poem_lines)

# Offer to email it
choice = input("\nWould you like to email this poem? (yes/no): ").lower()

if choice == "yes":
    send_email(name, email, poem)
    print("Your email draft is ready!")