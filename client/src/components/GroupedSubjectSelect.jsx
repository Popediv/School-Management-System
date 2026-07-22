/**
 * GroupedSubjectSelect
 * A reusable <select> that groups subjects by level (JSS / SS) and category.
 * Optionally auto-filters based on the currently selected class name.
 *
 * Props:
 *  - subjects: full subject array from the API
 *  - value: selected subject id
 *  - onChange: (e) => void
 *  - selectedClassName: e.g. "JSS1A", "SSS2B" — used to auto-filter level
 *  - className: extra CSS class for the <select> element
 *  - id / name: passed through to the <select>
 */
export default function GroupedSubjectSelect({
  subjects = [],
  value,
  onChange,
  selectedClassName = '',
  className = 'form-select',
  ...rest
}) {
  // Detect level from the class name string
  const classUpper = selectedClassName.toUpperCase();
  const detectedLevel = classUpper.startsWith('JSS')
    ? 'JSS'
    : classUpper.startsWith('SS') || classUpper.startsWith('SSS')
    ? 'SS'
    : null; // null means show all

  // Filter subjects by the detected level (if any).
  // Subjects with level "ALL" are available for both JSS and SS.
  const filtered = detectedLevel
    ? subjects.filter(s => s.level === detectedLevel || s.level === 'ALL')
    : subjects;

  // Group by level then category
  // Structure: { JSS: { Core: [...], ... }, SS: { Core: [...], Science: [...], ... } }
  const grouped = {};
  for (const sub of filtered) {
    const lvl = sub.level || 'Other';
    const cat = sub.category || 'General';
    if (!grouped[lvl]) grouped[lvl] = {};
    if (!grouped[lvl][cat]) grouped[lvl][cat] = [];
    grouped[lvl][cat].push(sub);
  }

  const levelOrder = ['JSS', 'SS', 'Other'];
  const levelLabels = { JSS: 'Junior Secondary (JSS)', SS: 'Senior Secondary (SS)', Other: 'Other' };

  return (
    <select className={className} value={value} onChange={onChange} {...rest}>
      {levelOrder
        .filter(lvl => grouped[lvl])
        .map(lvl =>
          Object.entries(grouped[lvl]).map(([cat, subs]) => (
            <optgroup key={`${lvl}-${cat}`} label={`${levelLabels[lvl]} — ${cat}`}>
              {subs.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </optgroup>
          ))
        )}
    </select>
  );
}
