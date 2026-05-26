import os
import pypdf

def extract_pdf_text(filepath, out_path):
    try:
        reader = pypdf.PdfReader(filepath)
        with open(out_path, 'w', encoding='utf-8') as f:
            for idx, page in enumerate(reader.pages):
                f.write(f"--- PAGE {idx+1} ---\n")
                f.write(page.extract_text() + "\n\n")
        print(f"Successfully extracted text to {out_path}")
    except Exception as e:
        print(f"Error reading with pypdf: {e}")

pdf3 = r"C:\Users\Marco\Documents\Office\Invoice\reso\Sample3.pdf"
pdf3_1 = r"C:\Users\Marco\Documents\Office\Invoice\reso\Sample3.1.pdf"

extract_pdf_text(pdf3, r"C:\Users\Marco\Documents\Office\Invoice\scratch\extracted_pdf3.txt")
extract_pdf_text(pdf3_1, r"C:\Users\Marco\Documents\Office\Invoice\scratch\extracted_pdf3_1.txt")
