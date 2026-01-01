import modal

app = modal.App("moodboard-test")


@app.function()
def square(x):
    print("This code is running on a remote worker!")
    return x**2


@app.local_entrypoint()
def main():
    print("Testing Modal connection...")
    result = square.remote(42)
    print(f"✅ Modal works! The square of 42 is {result}")
