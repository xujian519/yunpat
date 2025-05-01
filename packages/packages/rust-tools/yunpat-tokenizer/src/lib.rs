//! YunPat 文本分词器
//!
//! 提供中英文混合文本分词、关键词提取、文本统计等功能

/// 分词结果
#[derive(Debug, Clone)]
pub struct Token {
    pub text: String,
    pub start: usize,
    pub end: usize,
}

/// 文本统计信息
#[derive(Debug)]
pub struct TextStats {
    pub char_count: usize,
    pub word_count: usize,
    pub line_count: usize,
    pub cjk_char_count: usize,
    pub ascii_word_count: usize,
}

/// 对文本进行简单分词（基于空格和标点）
///
/// 支持中英文混合文本：英文按空格分词，中文按字符分词
pub fn tokenize(text: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut current_start = 0;
    let mut current_token = String::new();

    for (i, ch) in text.char_indices() {
        if ch.is_whitespace() || is_cjk_punctuation(ch) {
            if !current_token.is_empty() {
                tokens.push(Token {
                    text: current_token.clone(),
                    start: current_start,
                    end: i,
                });
                current_token.clear();
            }
            current_start = i + ch.len_utf8();
        } else if is_cjk_char(ch) {
            // 先 flush 当前 token
            if !current_token.is_empty() {
                tokens.push(Token {
                    text: current_token.clone(),
                    start: current_start,
                    end: i,
                });
                current_token.clear();
            }
            // CJK 字符单独作为一个 token
            tokens.push(Token {
                text: ch.to_string(),
                start: i,
                end: i + ch.len_utf8(),
            });
            current_start = i + ch.len_utf8();
        } else {
            if current_token.is_empty() {
                current_start = i;
            }
            current_token.push(ch);
        }
    }

    // flush 最后一个 token
    if !current_token.is_empty() {
        tokens.push(Token {
            text: current_token,
            start: current_start,
            end: text.len(),
        });
    }

    tokens
}

/// 统计文本信息
pub fn text_stats(text: &str) -> TextStats {
    let char_count = text.chars().count();
    let cjk_char_count = text.chars().filter(|c| is_cjk_char(*c)).count();
    let line_count = text.lines().count().max(1);
    let words = tokenize(text);
    let ascii_word_count = words.iter().filter(|t| t.text.chars().all(|c| !is_cjk_char(c))).count();

    TextStats {
        char_count,
        word_count: words.len(),
        line_count,
        cjk_char_count,
        ascii_word_count,
    }
}

/// 从文本中提取关键词（基于词频）
pub fn extract_keywords(text: &str, top_n: usize) -> Vec<(String, usize)> {
    let tokens = tokenize(text);
    let mut freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

    for token in &tokens {
        // 过滤停用词和短词
        let word = token.text.to_lowercase();
        if word.len() < 2 && !is_cjk_char(word.chars().next().unwrap_or(' ')) {
            continue;
        }
        if is_stop_word(&word) {
            continue;
        }
        *freq.entry(word).or_insert(0) += 1;
    }

    let mut pairs: Vec<(String, usize)> = freq.into_iter().collect();
    pairs.sort_by(|a, b| b.1.cmp(&a.1));
    pairs.truncate(top_n);
    pairs
}

/// 判断是否为 CJK 字符
fn is_cjk_char(ch: char) -> bool {
    matches!(ch,
        '\u{4E00}'..='\u{9FFF}' |   // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}' |   // CJK Extension A
        '\u{3000}'..='\u{303F}' |   // CJK Symbols
        '\u{FF00}'..='\u{FFEF}'     // Halfwidth and Fullwidth Forms
    )
}

/// 判断是否为 CJK 标点
fn is_cjk_punctuation(ch: char) -> bool {
    matches!(ch,
        '，' | '。' | '、' | '；' | '：' |
        '？' | '！' | '"' | '"' | '\'' |
        '\'' | '【' | '】' | '（' | '）' |
        '《' | '》'
    )
}

/// 简单停用词表
fn is_stop_word(word: &str) -> bool {
    const STOP_WORDS: &[&str] = &[
        "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
        "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
        "你", "会", "着", "没有", "看", "好", "自己", "这",
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "shall", "can", "of",
        "in", "to", "for", "with", "on", "at", "from", "by", "as",
    ];
    STOP_WORDS.contains(&word)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_english() {
        let tokens = tokenize("hello world");
        assert_eq!(tokens.len(), 2);
        assert_eq!(tokens[0].text, "hello");
        assert_eq!(tokens[1].text, "world");
    }

    #[test]
    fn test_tokenize_chinese() {
        let tokens = tokenize("专利申请");
        // 每个汉字是独立 token
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0].text, "专");
    }

    #[test]
    fn test_tokenize_mixed() {
        let tokens = tokenize("IPC分类号 G06F");
        assert!(tokens.len() > 0);
        // 应该包含 "IPC" "G06F" 和单独的中文字符
        let texts: Vec<&str> = tokens.iter().map(|t| t.text.as_str()).collect();
        assert!(texts.contains(&"IPC"));
        assert!(texts.contains(&"G06F"));
    }

    #[test]
    fn test_tokenize_empty() {
        let tokens = tokenize("");
        assert!(tokens.is_empty());
    }

    #[test]
    fn test_tokenize_whitespace_only() {
        let tokens = tokenize("   ");
        assert!(tokens.is_empty());
    }

    #[test]
    fn test_text_stats() {
        let stats = text_stats("Hello 世界");
        assert_eq!(stats.char_count, 8); // H e l l o (space) 世 界
        assert!(stats.cjk_char_count >= 2);
    }

    #[test]
    fn test_text_stats_empty() {
        let stats = text_stats("");
        assert_eq!(stats.char_count, 0);
        assert_eq!(stats.word_count, 0);
    }

    #[test]
    fn test_extract_keywords() {
        let text = "patent application patent review patent invention";
        let keywords = extract_keywords(text, 3);
        assert!(!keywords.is_empty());
        // "patent" 应该是高频词
        assert!(keywords.iter().any(|(w, _)| w == "patent"));
    }

    #[test]
    fn test_extract_keywords_filters_stopwords() {
        let text = "的 了的 hello world 的";
        let keywords = extract_keywords(text, 10);
        // 停用词应该被过滤
        let words: Vec<&str> = keywords.iter().map(|(w, _)| w.as_str()).collect();
        assert!(!words.contains(&"的"));
        assert!(!words.contains(&"了"));
    }

    #[test]
    fn test_token_positions() {
        let tokens = tokenize("ab cd");
        assert_eq!(tokens[0].start, 0);
        assert_eq!(tokens[0].end, 2);
        assert_eq!(tokens[1].start, 3);
        assert_eq!(tokens[1].end, 5);
    }
}
