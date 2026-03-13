pipeline {
    agent {
        kubernetes {
            yaml '''
            apiVersion: v1
            kind: Pod
            spec:
              containers:
              - name: golang
                image: golang:1.21-alpine
                command:
                - cat
                tty: true
                resources:
                  requests:
                    memory: "128Mi"
                    cpu: "100m"
                  limits:
                    memory: "512Mi"
                    cpu: "500m"
              - name: docker
                image: docker:dind
                command:
                - cat
                tty: true
                securityContext:
                  privileged: true
                env:
                - name: DOCKER_TLS_CERTDIR
                  value: ""
                resources:
                  requests:
                    memory: "256Mi"
                    cpu: "100m"
                  limits:
                    memory: "1024Mi"
                    cpu: "1000m"
            '''
        }
    }

    environment {
        DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
        DOCKER_IMAGE = 'chuitrai2901/vdt-go-app'
        APP_NAME = 'vdt-go-app'
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/chuitrai/viettel-devops-app.git'
            }
        }

        stage('Test & Lint Go Code') {
            steps {
                container('golang') {
                    dir('go-app') {
                        // Cấu hình Go proxy và tải thư viện
                        sh 'go env -w GOPROXY=https://goproxy.io,direct'
                        sh 'go mod download'
                        sh 'go fmt ./...'
                        sh 'go vet ./...'
                    }
                }
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                container('docker') {
                    script {
                        // Khởi động Docker daemon
                        sh 'dockerd-entrypoint.sh &'
                        sleep 10 // Đợi lâu hơn một chút cho DIND khởi động

                        dir('go-app') {
                            // Đánh version tự động theo BUILD_NUMBER của Jenkins
                            def imageTag = "${env.BUILD_NUMBER}"
                            def fullImageName = "${env.DOCKER_IMAGE}:${imageTag}"
                            def latestImageName = "${env.DOCKER_IMAGE}:latest"

                            // Đăng nhập Docker Hub và Push
                            withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDENTIALS, passwordVariable: 'DOCKERHUB_PASS', usernameVariable: 'DOCKERHUB_USER')]) {
                                sh "echo \$DOCKERHUB_PASS | docker login -u \$DOCKERHUB_USER --password-stdin"
                                sh "docker build -t ${fullImageName} -t ${latestImageName} ."
                                sh "docker push ${fullImageName}"
                                sh "docker push ${latestImageName}"
                            }
                        }
                    }
                }
            }
        }
        
        stage('Update Helm Chart') {
            steps {
                container('golang') {
                    script {
                        def imageTag = "${env.BUILD_NUMBER}"
                        
                        dir('go-app/helm-chart') {
                            // Sửa file values.yaml bằng sed để cập nhật dòng tag
                            sh "sed -i 's|tag: .*|tag: \"'${imageTag}'\"|g' values.yaml"
                        }

                        // Push lại file đã sửa version lên Github để ArgoCD tự đọc
                        withCredentials([usernamePassword(credentialsId: 'github-creds', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME')]) {
                            sh '''
                                git config --global user.email "jenkins@viettel.com"
                                git config --global user.name "Jenkins CI"
                                git add go-app/helm-chart/values.yaml
                                git commit -m "Jenkins Update Helm Image Tag to version ${BUILD_NUMBER} [skip ci]" || echo "No changes to commit"
                                git push origin HEAD:main
                            '''
                        }
                    }
                }
            }
        }
    }
}
