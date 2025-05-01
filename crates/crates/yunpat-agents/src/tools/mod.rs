pub mod document;
pub mod legal_db;
pub mod ocr;
pub mod paper_search;
pub mod patent_db;
pub mod patent_download;
pub mod patent_search;

pub use document::{DocumentFormat, DocumentGenerator, DocumentParser, ParseResult};
pub use legal_db::{KgNode, LegalArticle, LegalDatabase, LegalDocument, LegalSearchResult};
pub use ocr::{OcrResult, OcrTool};
pub use paper_search::{PaperRecord, PaperSearchResult, PaperSearchTool};
pub use patent_db::{PatentDatabase, PatentDbRecord, PatentDbSearchResult};
pub use patent_download::{PatentDownloadResult, PatentDownloadTool};
pub use patent_search::{PatentRecord, PatentSearchResult, PatentSearchTool};
