import React, { useState, useContext, useEffect } from "react";
import CategoryCard from "../CategoryCard/CategoryCard";
import "./Home.css";
import { parseAuditHTML } from "../../util/api";
import { UploadContext } from "../../context/UploadContext";

const Home = () => {
    const { uploadedData, setUploadedData } = useContext(UploadContext);
    const [categories, setCategories] = useState([]);
    const [exampleAudit, setExampleAudit] = useState("");
    const [showExamplePreview, setShowExamplePreview] = useState(true); // 👈 control visibility

    useEffect(() => {
        if (uploadedData) {
            const parsedData = parseAuditHTML(uploadedData);
            setCategories(parsedData);
        } else {
            // load the example audit for preview
            fetch("/kyleaudit.html")
                .then((res) => res.text())
                .then((html) => setExampleAudit(html))
                .catch((err) => console.error("Failed to load example audit", err));
        }
    }, [uploadedData]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileContent = e.target.result;
                const parsedData = parseAuditHTML(fileContent);
                setCategories(parsedData);
                setUploadedData(fileContent);
                setShowExamplePreview(false); // 👈 hide preview once user uploads
            };
            reader.readAsText(file);
        }
    };

    const completedCategories = categories.filter((c) => c.isCompleted);
    const incompleteCategories = categories.filter((c) => !c.isCompleted);

    return (
        <div className="category-cards-container">
            <h1>Upload your degree audit here to make it more readable!</h1>

            <div className="upload-box">
                {/* Upload button */}
                <label className="upload-button">
                    Upload Degree Audit
                    <input
                        type="file"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                        accept=".html"
                    />
                </label>

                {/* Example button – only visible until user uploads */}
                {!uploadedData && (
                    <button
                        className="demo-button"
                        onClick={() => {
                            const parsed = parseAuditHTML(exampleAudit);
                            setCategories(parsed);
                            setUploadedData(exampleAudit);
                            setShowExamplePreview(false);
                        }}
                    >
                       ↓ Try This Example Audit! ↓
                    </button>
                )}
            </div>

            {/* Example audit preview */}
            {showExamplePreview && exampleAudit && (
                <div
                    className="mt-4 max-h-96 overflow-y-scroll border rounded-lg p-3 bg-white shadow-inner"
                    style={{ fontSize: "0.85rem" }}
                    dangerouslySetInnerHTML={{ __html: exampleAudit }}
                />
            )}

            {categories.length > 0 ? (
                <>
                    <h2>Incomplete Categories</h2>
                    <div className="category-list">
                        {incompleteCategories.map((category) => (
                            <CategoryCard key={category.id} category={category} />
                        ))}
                    </div>
                    <h2>Completed Categories</h2>
                    <div className="category-list">
                        {completedCategories.map((category) => (
                            <CategoryCard key={category.id} category={category} />
                        ))}
                    </div>
                </>
            ) : (
                <p>No audit uploaded yet.</p>
            )}
        </div>
    );
};

export default Home;
