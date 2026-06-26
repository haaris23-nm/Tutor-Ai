package com.tutorai.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import java.io.ByteArrayInputStream;
import java.io.IOException;

@Service
public class PDFService {

    public String extractText(byte[] pdfBytes) throws IOException {
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(pdfBytes))) {
            if (document.isEncrypted()) {
                throw new IOException("Cannot parse encrypted PDF file.");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            String rawText = stripper.getText(document);
            if (rawText == null || rawText.trim().isEmpty()) {
                return "No structured text could be extracted from this scanned or blank document layout.";
            }
            return rawText;
        } catch (Exception e) {
            throw new IOException("Failed to extract layout stream from file: " + e.getMessage());
        }
    }
}
