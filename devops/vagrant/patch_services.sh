#!/bin/bash
kubectl patch svc my-jenkins -n jenkins --type json -p '[
  {"op": "replace", "path": "/spec/type", "value": "NodePort"},
  {"op": "replace", "path": "/spec/ports/0/nodePort", "value": 32000}
]'

kubectl patch svc argocd-server -n argocd --type json -p '[
  {"op": "replace", "path": "/spec/type", "value": "NodePort"},
  {"op": "replace", "path": "/spec/ports/0/nodePort", "value": 32001},
  {"op": "replace", "path": "/spec/ports/1/nodePort", "value": 32002}
]'

echo "=== PATCH COMPLETED ==="
kubectl get svc -n jenkins my-jenkins
kubectl get svc -n argocd argocd-server
