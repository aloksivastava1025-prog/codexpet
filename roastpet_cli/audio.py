from dotenv import load_dotenv
import os
import pygame
import threading

def init_audio():
    # Only init once
    if not pygame.mixer.get_init():
        pygame.mixer.init()

def play_sound(sound_name: str):
    try:
        init_audio()
        # Assume sounds are in the same folder or an audio/ subfolder
        base_dir = os.path.dirname(os.path.abspath(__file__))
        sound_path = os.path.join(base_dir, 'audio', f"{sound_name}.mp3")
        
        if os.path.exists(sound_path):
            pygame.mixer.music.load(sound_path)
            pygame.mixer.music.play()
        else:
            print(f"[*] Missing audio piece: {sound_path}. Place it there to hear the meme!")
    except Exception as e:
        print(f"[*] Audio error: {e}")
