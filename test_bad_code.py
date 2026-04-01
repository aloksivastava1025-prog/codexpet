# This is intentionally terrible code for testing RoastPet
# @roastpet

def add_numbers(a, b):
    result = a + b
    result = a + b  # duplicate line, waste of CPU
    return result

def find_max(lst):
    max = 0  # shadowing builtin 'max'
    for i in range(0, len(lst)):  # should use enumerate
        if lst[i] > max:
            max = lst[i]
    return max

class user:  # class name should be capitalized
    def __init__(self, name, age):
        self.name = name
        self.age = age
        self.name = name  # duplicate assignment

    def greet(self):
        print("hello " + self.name)  # should use f-string
        return None  # unnecessary return

password = "admin123"  # hardcoded password lol
API_KEY = "sk-1234567890"  # exposed secret

import os  # import should be at top
import sys  # import should be at top

x = lambda a,b: a+b  # should be a regular function

try:
    result = 10 / 0
except:  # bare except, catches everything
    pass  # silently swallowing errors
