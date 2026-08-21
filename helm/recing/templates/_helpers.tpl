{{/*
Expand the name of the chart.
*/}}
{{- define "recing.name" -}}
{{- .Chart.Name }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "recing.labels" -}}
app.kubernetes.io/name: {{ include "recing.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
The postgres connection URL.
Uses secrets.postgresUrl when provided; otherwise derives it from postgres values.
*/}}
{{- define "recing.postgresUrl" -}}
{{- if .Values.secrets.postgresUrl -}}
  {{- .Values.secrets.postgresUrl -}}
{{- else -}}
  postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@{{ .Release.Name }}-postgres:5432/{{ .Values.postgres.database }}
{{- end -}}
{{- end }}

{{/*
Full image for a given component (web | ingestion).
*/}}
{{- define "recing.image" -}}
{{ .Values.image.registry }}/{{ .component }}:{{ .Values.image.tag }}
{{- end }}

{{/*
Full image for the migrate initContainer.
*/}}
{{- define "recing.migrateImage" -}}
{{ .Values.image.registry }}/migrate:{{ .Values.migrate.tag }}
{{- end }}

{{/*
Migrate initContainer definition — reused by web and ingestion.
*/}}
{{- define "recing.migrateInitContainer" -}}
- name: migrate
  image: {{ include "recing.migrateImage" . }}
  imagePullPolicy: {{ .Values.image.pullPolicy }}
  env:
  - name: POSTGRES_URL
    valueFrom:
      secretKeyRef:
        name: {{ .Release.Name }}-secrets
        key: postgres-url
  resources:
    requests:
      memory: 64Mi
      cpu: 25m
    limits:
      memory: 256Mi
      cpu: 200m
{{- end }}
