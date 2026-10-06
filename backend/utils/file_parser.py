import io
from typing import Tuple
from docx import Document
from pypdf import PdfReader


def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    """
    Extracts text from uploaded files based on extension (.txt, .docx, .pdf).
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    
    if ext == "txt":
        # Attempt decoding with utf-8 first, fallback to latin-1
        try:
            return content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return content_bytes.decode("latin-1", errors="replace")

    elif ext == "docx":
        doc_stream = io.BytesIO(content_bytes)
        doc = Document(doc_stream)
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text.strip())
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    text_parts.append(" | ".join(row_text))
        return "\n\n".join(text_parts)

    elif ext == "pdf":
        pdf_stream = io.BytesIO(content_bytes)
        reader = PdfReader(pdf_stream)
        pages_text = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                pages_text.append(page_text.strip())
        return "\n\n".join(pages_text)

    else:
        # Default try utf-8
        try:
            return content_bytes.decode("utf-8")
        except Exception as e:
            raise ValueError(f"Unsupported file format: {ext}. Supported formats are .txt, .docx, .pdf")
