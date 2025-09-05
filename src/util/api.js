// src/util/api.js
const TERM_SEQUENCE = [1258, 1254, 1252, 1248]; // AU25, SU25, SP25, AU24 (adjust as needed)

function splitCourse(subject, classNmbr) {
  const subj = String(subject || "").trim().toUpperCase();
  const numRaw = String(classNmbr || "").trim();
  // Strip common suffixes like H, E, etc. (e.g., 2231H → 2231)
  const numCore = numRaw.replace(/[^0-9]/g, "");
  return { subj, numRaw, numCore };
}

async function fetchOnce(subj, classNmbr, term, opts = {}) {
  const q = encodeURIComponent(`${subj} ${classNmbr}`);
  // Try with campus=col first; OSU content API can be picky by campus/term.
  const url = `https://content.osu.edu/v2/classes/search?q=${q}&client=class-search-ui&campus=col&term=${term}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: opts.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}…`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected JSON but got ${ct} — ${text.slice(0, 200)}…`);
  }

  const data = await res.json();
  const raw =
    (Array.isArray(data?.data?.courses) && data.data.courses) ||
    (Array.isArray(data?.data?.classes) && data.data.classes) ||
    [];
  const courses = raw.map((it) => it?.course ?? it).filter(Boolean);

  console.debug(`[fetchData] term=${term} q=${subj} ${classNmbr} results=${courses.length}`, data);
  return courses;
}

function toClassData(match, fallbackSubj, fallbackNum) {
  return {
    classNumber: match?.catalogNumber ?? fallbackNum ?? "",
    subject: match?.subject ?? fallbackSubj ?? "",
    title: match?.title ?? match?.longDesc ?? "Course not found",
    units: match?.maxUnits ?? match?.units ?? match?.minUnits ?? 0,
    description: match?.description ?? match?.longDescription ?? "",
    courseID: match?.courseId ?? match?.id ?? null,
    notFound: !match,
  };
}

export const fetchData = async (subject, classNmbr, opts = {}) => {
  const { subj, numRaw, numCore } = splitCourse(subject, classNmbr);

  // Try each term; if none return hits, return a graceful "not found" object
  for (const term of TERM_SEQUENCE) {
    try {
      const courses = await fetchOnce(subj, numRaw, term, opts);
      if (courses.length) {
        // Prefer exact match on catalogNumber; if none, try numeric-only, then fallback first
        const byExact =
          courses.find(
            (c) =>
              String(c?.subject || "").toUpperCase() === subj &&
              String(c?.catalogNumber || "").replace(/\s+/g, "") === numRaw.replace(/\s+/g, "")
          ) || null;

        const byCore =
          byExact ||
          courses.find(
            (c) =>
              String(c?.subject || "").toUpperCase() === subj &&
              String(c?.catalogNumber || "").replace(/\D/g, "") === numCore
          ) ||
          null;

        return toClassData(byCore, subj, numRaw);
      }

      // If zero, try again without campus filter once per term
      const urlNoCampusCourses = await (async () => {
        const q = encodeURIComponent(`${subj} ${numRaw}`);
        const res = await fetch(
          `https://content.osu.edu/v2/classes/search?q=${q}&client=class-search-ui&term=${term}`,
          { headers: { Accept: "application/json" }, signal: opts.signal }
        );
        if (!res.ok) return [];
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return [];
        const data = await res.json();
        const raw =
          (Array.isArray(data?.data?.courses) && data.data.courses) ||
          (Array.isArray(data?.data?.classes) && data.data.classes) ||
          [];
        const courses2 = raw.map((it) => it?.course ?? it).filter(Boolean);
        console.debug(`[fetchData] term=${term} (no campus) results=${courses2.length}`, data);
        return courses2;
      })();

      if (urlNoCampusCourses.length) {
        const byCore =
          urlNoCampusCourses.find(
            (c) =>
              String(c?.subject || "").toUpperCase() === subj &&
              String(c?.catalogNumber || "").replace(/\D/g, "") === numCore
          ) || urlNoCampusCourses[0];
        return toClassData(byCore, subj, numRaw);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      // continue trying other terms
    }
  }

  // Graceful fallback object—prevents the whole UI from erroring out
  return toClassData(null, subj, numRaw);
};

export function parseAuditHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const requirements = [];
  let id = 0;

  const reqTitleElements = doc.getElementsByClassName("reqTitle");
  const reqTitles = Array.from(reqTitleElements);

  const excludedTitles = [
    "current/ future term schedule",
    "computer science engineering required non-major coursework",
    "THEMATIC PATHWAYS - COMPLETE THE CITIZENSHIP FOR A DIVERSE AND JUST WORLD THEME AND ONE ADDITIONAL THEME",
    "TRANSFER CREDIT: COURSE WORK THAT APPEARS HERE WILL NOT APPLY TO ANY DEGREE REQUIREMENTS.",
    "GENERAL GRADUATION REQUIREMENTS (MINIMUM HOURS: 126)",
    "general education reflection",
    "BASIC MATH & SCIENCE - ABET REQUIREMENTS: 30 HR MIN",
    "THEMATIC PATHWAYS - COMPLETE THE CITIZENSHIP FOR A DIVERSEAND JUST WORLD THEME AND ONE ADDITIONAL THEME.",
  ];

  reqTitles.forEach((reqTitleElement) => {
    const title = reqTitleElement.textContent.trim();
    if (excludedTitles.some((ex) => title.toLowerCase() === ex.toLowerCase())) return;

    const requirement = { id: id++, title, class: { completed: [], incompleted: [], inProgress: [] } };

    const requirementNode = reqTitleElement.closest(".requirement");
    const completedCoursesElements = requirementNode.getElementsByClassName("completedCourses");

    let lastSubject = "";

    Array.from(completedCoursesElements).forEach((courseTable) => {
      const courses = courseTable.getElementsByClassName("takenCourse");
      Array.from(courses).forEach((courseRow) => {
        const courseData = {
          term: courseRow.getElementsByClassName("term")[0]?.textContent.trim() || "",
          course: courseRow.getElementsByClassName("course")[0]?.textContent.trim() || "",
          credit: parseFloat(courseRow.getElementsByClassName("credit")[0]?.textContent.trim()) || 0,
          grade: courseRow.getElementsByClassName("grade")[0]?.textContent.trim() || "",
          completed: !courseRow.classList.contains("ip"),
          inProgress: courseRow.classList.contains("ip"),
        };

        if (!isNaN(courseData.course) && lastSubject) {
          courseData.course = `${lastSubject} ${courseData.course}`;
        } else {
          const parts = courseData.course.split(/\s+/);
          lastSubject = parts[0];
        }

        if (courseData.inProgress) {
          requirement.class.inProgress.push(courseData.course);
        } else {
          requirement.class.completed.push(courseData.course);
        }
      });
    });

    const draggableCourses = requirementNode.getElementsByClassName("course draggable");
    if (draggableCourses.length) {
      requirement.class.incompleted = Array.from(draggableCourses).map((course) => {
        let courseText = course.textContent.trim();
        if (!isNaN(courseText) && lastSubject) {
          return `${lastSubject} ${courseText}`;
        } else {
          const parts = courseText.split(/\s+/);
          if (parts.length === 2) lastSubject = parts[0];
          return courseText;
        }
      });
    }

    requirement.isCompleted =
      requirement.class.incompleted.length === 0 && requirement.class.inProgress.length === 0;

    requirements.push(requirement);
  });

  return requirements;
}
