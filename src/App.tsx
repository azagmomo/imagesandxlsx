import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, Image as ImageIcon, Copy, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface PairData {
    id: string;
    image: string; // Object URL
    text: string;
}

function App() {
    const [excelData, setExcelData] = useState<string[]>([]);
    const [images, setImages] = useState<string[]>([]);
    const [pairs, setPairs] = useState<PairData[]>([]);
    const [copiedTextId, setCopiedTextId] = useState<string | null>(null);
    const [copiedImageId, setCopiedImageId] = useState<string | null>(null);

    // --- File Handlers --- //

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Convert sheet to JSON, array of arrays to easily access col C
                const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

                // Column C is index 2, starting from row 2 (index 1)
                const colCData: string[] = [];
                for (let i = 1; i < data.length; i++) {
                    const row = data[i];
                    if (row && row.length > 2 && typeof row[2] === 'string' && row[2].trim() !== '') {
                        colCData.push(row[2].trim());
                    }
                }

                setExcelData(colCData);
                generatePairs(colCData, images);
            } catch (err) {
                console.error("Error parsing Excel:", err);
                alert("Failed to parse Excel file. Make sure it's a valid .xlsx file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Create Object URLs and sort them (assuming names like 1.jpg, 2.jpg)
        // Try natural sort if filenames are numeric
        const sortedFiles = files.sort((a, b) => {
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        const newImages = sortedFiles.map(file => URL.createObjectURL(file));

        // Append or replace depending on what user prefers. Here we replace for simplicity.
        setImages(newImages);
        generatePairs(excelData, newImages);
    };

    const generatePairs = useCallback((texts: string[], imgs: string[]) => {
        if (texts.length === 0 && imgs.length === 0) {
            setPairs([]);
            return;
        }

        const newPairs: PairData[] = [];
        const maxLength = Math.max(texts.length, imgs.length);

        for (let i = 0; i < maxLength; i++) {
            newPairs.push({
                id: `pair-${i}`,
                text: texts[i] || 'No text available for this row.',
                image: imgs[i] || '', // Empty if no image
            });
        }
        setPairs(newPairs);
    }, []);

    // --- Copy Handlers --- //

    const handleCopyText = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTextId(id);
            setTimeout(() => setCopiedTextId(null), 2000);
        } catch (err) {
            console.error('Failed to copy text', err);
            alert('Failed to copy text.');
        }
    };

    const handleCopyImage = async (imageUrl: string, id: string) => {
        try {
            if (!imageUrl) return;

            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // Need standard image/png for clipboard API, or it might throw
            // Trying to write blob directly to ClipboardItem
            let clipboardBlob = blob;

            // If it's a JPEG, some browsers require it to be PNG for clipboard.
            // Let's do a quick conversion using a canvas if it's not PNG.
            if (blob.type !== 'image/png') {
                clipboardBlob = await convertToPngBlob(imageUrl);
            }

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': clipboardBlob })
            ]);

            setCopiedImageId(id);
            setTimeout(() => setCopiedImageId(null), 2000);
        } catch (err) {
            console.error('Failed to copy image', err);
            alert('Failed to copy image. Your browser might not support this feature or requires permission.');
        }
    };

    const convertToPngBlob = (imageUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('No canvas context');
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject('Canvas to Blob failed');
                }, 'image/png');
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <motion.h1
                    className="app-title"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    Automator Flow
                </motion.h1>
                <motion.p
                    className="app-subtitle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    Pair your images with Excel data effortlessly.
                </motion.p>
            </header>

            <motion.div
                className="upload-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
            >
                {/* Excel Upload */}
                <label className="upload-zone glass-panel">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleExcelUpload}
                        className="hidden"
                        style={{ display: 'none' }}
                    />
                    <UploadCloud className="upload-icon" size={48} />
                    <span className="upload-text">
                        {excelData.length > 0 ? `Loaded ${excelData.length} Texts` : 'Upload data.xlsx'}
                    </span>
                    <span className="upload-subtext">Extracts Column C automatically</span>
                </label>

                {/* Image Upload */}
                <label className="upload-zone glass-panel">
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                        style={{ display: 'none' }}
                    />
                    <ImageIcon className="upload-icon" size={48} />
                    <span className="upload-text">
                        {images.length > 0 ? `Loaded ${images.length} Images` : 'Upload Images'}
                    </span>
                    <span className="upload-subtext">Drop multiple images here</span>
                </label>
            </motion.div>

            {/* Results */}
            {pairs.length > 0 && (
                <motion.div
                    className="pairing-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {pairs.map((pair, index) => (
                        <motion.div
                            key={pair.id}
                            className="pairing-card glass-panel"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <div className="card-image-container">
                                {pair.image ? (
                                    <img src={pair.image} alt={`Pair ${index + 1}`} className="card-image" />
                                ) : (
                                    <div className="card-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8' }}>
                                        <ImageIcon size={32} />
                                    </div>
                                )}
                            </div>

                            <div className="card-content">
                                <h3 className="card-title">Item {index + 1}</h3>
                                <p className="card-text">{pair.text}</p>
                            </div>

                            <div className="card-actions">
                                <button
                                    className={`action-btn ${copiedImageId === pair.id ? 'btn-success' : 'btn-primary'}`}
                                    onClick={() => handleCopyImage(pair.image, pair.id)}
                                    disabled={!pair.image}
                                    title={!pair.image ? "No image to copy" : "Copy Image"}
                                >
                                    {copiedImageId === pair.id ? <CheckCircle2 size={18} /> : <ImageIcon size={18} />}
                                    <span>{copiedImageId === pair.id ? 'Copied!' : 'Copy Img'}</span>
                                </button>

                                <button
                                    className={`action-btn ${copiedTextId === pair.id ? 'btn-success' : 'btn-secondary'}`}
                                    onClick={() => handleCopyText(pair.text, pair.id)}
                                >
                                    {copiedTextId === pair.id ? <CheckCircle2 size={18} /> : <FileText size={18} />}
                                    <span>{copiedTextId === pair.id ? 'Copied!' : 'Copy Txt'}</span>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}

export default App;
