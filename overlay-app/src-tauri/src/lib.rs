use tauri::{Manager, Emitter};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use std::sync::atomic::{AtomicBool, Ordering};

static H_HIDDEN: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Disable GPU hardware acceleration to fix black background when screen sharing on Windows
  std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--disable-gpu");

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let ctrl_shift_d = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
      let ctrl_m       = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyM);
      let ctrl_h       = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyH);

      let handle = app.handle().clone();

      app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
          .with_handler(move |_app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
              return;
            }
            if let Some(window) = handle.get_webview_window("main") {
              match shortcut.key {
                Code::KeyD => {
                  // Ctrl+Shift+D: toggle drawing mode via event
                  let _ = window.set_always_on_top(true);
                  let _ = window.set_focus();
                  let _ = window.emit("shortcut-toggle-draw", "toggle");
                }
                Code::KeyM => {
                  // Ctrl+M: minimize/restore in pure Rust
                  if let Ok(true) = window.is_minimized() {
                    let _ = window.unminimize();
                    let _ = window.set_always_on_top(true);
                    let _ = window.set_focus();
                  } else {
                    let _ = window.minimize();
                  }
                }
                Code::KeyH => {
                  // Ctrl+H: hide/show ONLY the toolbar and notification
                  let was_hidden = H_HIDDEN.fetch_xor(true, Ordering::Relaxed);
                  let now_hidden = !was_hidden;
                  if now_hidden {
                    let _ = window.eval(
                      "['toolbar','notification'].forEach(\
                        function(id){var e=document.getElementById(id);if(e)e.style.display='none';}\
                      );"
                    );
                  } else {
                    let _ = window.eval(
                      "['toolbar','notification'].forEach(\
                        function(id){var e=document.getElementById(id);if(e)e.style.display='';}\
                      );"
                    );
                  }
                }
                _ => {}
              }
            }
          })
          .build(),
      )?;

      app.global_shortcut().register(ctrl_shift_d)?;
      app.global_shortcut().register(ctrl_m)?;
      app.global_shortcut().register(ctrl_h)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
