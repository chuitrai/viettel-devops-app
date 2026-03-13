{{/* Define the full name of the app for naming resources consistently */}}
{{- define "vdt-go-app.fullname" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}
