export function ModelValidation() {
  return (
    <details className="model-validation">
      <summary>Model evaluation scope</summary>
      <h3>Stack-d5 ranking model</h3>
      <p>
        Eight frozen experts and prior transaction context feed a nonlinear
        ranking model. Auto suggests an upload-wide queue from score separation;
        review capacity remains adjustable.
      </p>
      <p>
        Selection used exposed development datasets from multiple sources. This
        is not independent validation, and scores are not calibrated fraud
        probabilities. Performance varies with source, available fields and
        account history.
      </p>
      <p>
        These IBM and Sparkov samples were selected for clear detections with
        the current automatic queue. Original purchase values and fraud labels
        are preserved. Focused incidents can have higher fraud rates than an
        ordinary upload; larger examples retain misses and false alerts.
        Supplied labels stay separate from scoring.
      </p>
    </details>
  );
}
