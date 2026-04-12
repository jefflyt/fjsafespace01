# WeasyPrint Template Cheatsheet

Quick reference for common WeasyPrint CSS features and Jinja2 syntax for FJ SafeSpace.

## WeasyPrint Specific CSS
```css
@page {
    size: A4 portrait;
    margin: 20mm;
    @top-right {
        content: "FJ SafeSpace — Confidential";
        font-size: 8pt;
    }
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
    }
}

.executive-brief {
    page-break-after: always;
}

.finding-row {
    break-inside: avoid;
}
```

## Jinja2 Syntax
```html
{% for finding in findings %}
    <div class="finding-row {{ finding.threshold_band|lower }}">
        <h3>{{ finding.metric_name|replace('_', ' ')|upper }}</h3>
        <p>{{ finding.interpretation_text }}</p>
        <span class="badge">{{ finding.source_currency_status }}</span>
    </div>
{% endfor %}
```

## Report Types
- `ASSESSMENT`: Focuses on current baseline.
- `INTERVENTION_IMPACT`: Focuses on "Before vs. After" comparison and success metrics.
