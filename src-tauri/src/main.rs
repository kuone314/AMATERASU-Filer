#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[macro_use]
extern crate serde;

use std::time::Duration;
use tauri::Manager;

mod get_exe_dir;
use get_exe_dir::get_exe_dir;

mod get_entries;
use get_entries::get_entries;

mod setting_file;
use setting_file::read_setting_file;
use setting_file::setting_dir;
use setting_file::write_setting_file;

mod adjust_addressbar_str;
use adjust_addressbar_str::adjust_addressbar_str;

mod execute_shell_command;
use execute_shell_command::execute_shell_command;
use execute_shell_command::push_log_message;

mod get_latest_version;
mod update_filer;
use get_latest_version::get_latest_version;
use update_filer::update_filer;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_entries,
            adjust_addressbar_str,
            execute_shell_command,
            read_setting_file,
            write_setting_file,
            setting_dir,
            get_exe_dir,
            get_latest_version,
            update_filer,
        ])
        .setup(|app| {
            let app_handle = app.app_handle();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(1));
                push_log_message(&app_handle);
            });

            #[cfg(debug_assertions)]
            app.get_window("main").unwrap().open_devtools();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
