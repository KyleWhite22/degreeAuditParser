// CourseDetails.js
import React, { useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchData, parseAuditHTML } from '../../util/api';
import Popup from '../Popup/Popup';
import { UploadContext } from '../../context/UploadContext';
import './CourseDetails.css';

const CourseDetails = () => {
    const location = useLocation();
    const { category } = location.state || {};
    const { uploadedData } = useContext(UploadContext);
    const [classDataMap, setClassDataMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCourse, setSelectedCourse] = useState(null);

    const handleClassClick = (courseName) => {
        setSelectedCourse(classDataMap[courseName]);
    };

    const handleClosePopup = () => {
        setSelectedCourse(null);
    };

    useEffect(() => {
        if (!category || !uploadedData) return;

        let didCancel = false;

        (async () => {
            setLoading(true);
            setError(null);

            const classMap = {};
            const allLists = [
                { list: category.class.completed || [], status: "completed" },
                { list: category.class.incompleted || [], status: "incompleted" },
            ];

            try {
                for (const { list, status } of allLists) {
                    for (const className of list) {
                        const [subject, classNumber] = String(className).trim().split(/\s+/);
                        try {
                            const fetched = await fetchData(subject, classNumber);
                            // If not found, fetchData returns a graceful placeholder
                            classMap[className] = { ...fetched, status };
                        } catch {
                            // Absolute fallback if network/HTTP blew up
                            classMap[className] = {
                                classNumber,
                                subject,
                                title: "Unavailable",
                                units: 0,
                                description: "Could not load course details.",
                                courseID: null,
                                status,
                                notFound: true,
                            };
                        }
                        if (didCancel) return;
                    }
                }

                if (!didCancel) setClassDataMap(classMap);
            } catch (err) {
                if (!didCancel) setError(err.message || "Failed to load");
            } finally {
                if (!didCancel) setLoading(false);
            }
        })();

        return () => {
            didCancel = true;
        };
    }, [category, uploadedData]);

  const toNum = (v) => (typeof v === "number" ? v : parseFloat(v)) || 0;

const calculateTotalCredits = (classes) => {
  return (classes || []).reduce((total, className) => {
    const classData = classDataMap[className];
    return total + (classData ? toNum(classData.units) : 0);
  }, 0);
};

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    const completedCredits = calculateTotalCredits(category.class.completed);
    const incompleteCredits = calculateTotalCredits(category.class.incompleted);

    return (
        <div>
            <h2>{category.title}</h2>
            <div className="course-lists-container">
                <div className="incompleted-courses">
                    <h3>Need to Complete Courses:</h3>
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="course-name-column">Course Name</th>
                                <th className="credits-column">Credits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {category.class.incompleted.map((incompleteClass, index) => (
                                <tr key={index} onClick={() => handleClassClick(incompleteClass)} style={{ cursor: 'pointer' }}>
                                    <td className="course-name-column">
                                        {`${classDataMap[incompleteClass]?.subject} ${classDataMap[incompleteClass]?.classNumber}: ${classDataMap[incompleteClass]?.title}` || incompleteClass}
                                    </td>
                                    <td className="credits-column">{classDataMap[incompleteClass]?.units || 'N/A'}</td>
                                </tr>
                            ))}
                            <tr>
                                <td className="course-name-column"><strong>Total Credits</strong></td>
                                <td className="credits-column"><strong>{incompleteCredits}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="completed-courses">
                    <h3>Completed Courses:</h3>
                    <table className="table">
                        <thead>
                            <tr>
                                <th className="course-name-column">Course Name</th>
                                <th className="credits-column">Credits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {category.class.completed.map((completeClass, index) => (
                                <tr key={index} onClick={() => handleClassClick(completeClass)} style={{ cursor: 'pointer' }}>
                                    <td className="course-name-column">
                                        {`${classDataMap[completeClass]?.subject} ${classDataMap[completeClass]?.classNumber}: ${classDataMap[completeClass]?.title}` || completeClass}
                                    </td>
                                    <td className="credits-column">{classDataMap[completeClass]?.units || 'N/A'}</td>
                                </tr>
                            ))}
                            <tr>
                                <td className="course-name-column"><strong>Total Credits</strong></td>
                                <td className="credits-column"><strong>{completedCredits}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedCourse && (
                <Popup content={
                    <div>
                        <h3>{selectedCourse.title}</h3>
                        <p>
                            <span className="extra-space">Credit Hours: {selectedCourse.units}</span>
                            <span>Course ID: {selectedCourse.courseID}</span>
                        </p>
                        <p>{selectedCourse.description}</p>
                    </div>
                } handleClose={handleClosePopup} />
            )}
        </div>
    );
};

export default CourseDetails