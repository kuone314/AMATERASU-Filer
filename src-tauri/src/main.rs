#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[macro_use]
extern crate serde;

use std::fs;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_entries,
            adjust_addressbar_str,
            execute_shell_command,
            read_setting_file,
            write_setting_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

///////////////////////////////////////////////////////////////////////////////////////////////////
use std::env;
use std::io::Write;
#[tauri::command]
fn read_setting_file(filename: &str) -> String {
    fs::read_to_string(filename).unwrap_or_default()
}
#[tauri::command]
fn write_setting_file(filename: &str, content: &str) -> () {
    let mut file = fs::File::create(filename).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

///////////////////////////////////////////////////////////////////////////////////////////////////
use std::process::Command;
#[tauri::command]
fn execute_shell_command(dir: &str, command: &str) -> String {
    let output = Command::new("Powershell")
        .args(["-Command", &command])
        .current_dir(dir)
        .output();
    let output = match output {
        Ok(o) => o,
        Err(_) => return "Err".to_string(),
    };
    String::from_utf8_lossy(&output.stdout).to_string()
}

///////////////////////////////////////////////////////////////////////////////////////////////////
#[derive(Debug, Serialize, Deserialize)]
struct AdjustedAddressbarStr {
    dir: String,
}
#[tauri::command]
fn adjust_addressbar_str(str: &str) -> Result<AdjustedAddressbarStr, String> {
    let Ok(path) = dunce::canonicalize(&str) else {
        return Err("unfond".to_string());
    };

    let Ok(file_info) = fs::metadata(&path) else {
        return Err("unfond".to_string());
    };

    if file_info.is_file() {
        let Some(parent) = path.parent() else {
            return Err("unfond".to_string());
        };
        return Ok(AdjustedAddressbarStr {
            dir: parent.as_os_str().to_str().unwrap_or_default().to_string(),
        });
    }

    if file_info.is_dir() {
        return Ok(AdjustedAddressbarStr {
            dir: path.as_os_str().to_str().unwrap_or_default().to_string(),
        });
    }

    return Err("unfond".to_string());
}

///////////////////////////////////////////////////////////////////////////////////////////////
#[derive(Serialize)]
#[serde(tag = "type")]
enum Entry {
    #[serde(rename = "file")]
    File { name: String, path: String },
    #[serde(rename = "dir")]
    Dir { name: String, path: String },
}

#[tauri::command]
fn get_entries(path: &str) -> Result<Vec<Entry>, String> {
    let entries = fs::read_dir(path).map_err(|e| format!("{}", e))?;

    let res = entries
        .filter_map(|entry| -> Option<Entry> {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let path = entry.path().to_string_lossy().to_string();
            let type_ = entry.file_type().ok()?;

            if type_.is_dir() {
                Some(Entry::Dir { name, path })
            } else if type_.is_file() {
                Some(Entry::File { name, path })
            } else {
                None
            }
        })
        .collect();

    Ok(res)
}
