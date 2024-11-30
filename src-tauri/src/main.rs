// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cortexai_desktop_lib::{self, chat::cancel_chat_generation};

fn main() {
    cortexai_desktop_lib::run();
}
