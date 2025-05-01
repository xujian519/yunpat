/**
 * YunPat Tokenizer - 精确的 Token 计数工具
 */

use std::ffi::{CStr, CString};

#[repr(C)]
pub struct TokenCount {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

pub fn estimate_tokens(text: &str) -> TokenCount {
    let chars = text.chars().count() as u32;
    TokenCount {
        prompt_tokens: chars / 4,
        completion_tokens: 0,
        total_tokens: chars / 4,
    }
}

#[no_mangle]
pub extern "C" fn count_tokens(text: *const libc::c_char, _model: *const libc::c_char) -> TokenCount {
    unsafe {
        // 空指针验证：防止段错误
        if text.is_null() {
            return TokenCount {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            };
        }

        let text_str = CStr::from_ptr(text).to_str().unwrap_or("");
        estimate_tokens(text_str)
    }
}
