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

  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command:
    - busybox
    - cat
    tty: true
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

                            sh 'go env -w GOPROXY=https://goproxy.io,direct'
                            sh 'go mod download'

                            sh '''
                            if [ -n "$(go fmt ./...)" ]; then
                            echo "Code is not formatted"
                            exit 1
                            fi
                            '''

                            sh 'go vet ./...'
                        }
                    }
                }
            }

            stage('Build & Push Docker Image (Kaniko)') {
                steps {
                    container('kaniko') {
                        script {
                            dir('go-app') {

                                def imageTag = "${env.BUILD_NUMBER}"
                                def fullImageName = "${env.DOCKER_IMAGE}:${imageTag}"
                                def latestImageName = "${env.DOCKER_IMAGE}:latest"

                                withCredentials([usernamePassword(
                                    credentialsId: env.DOCKERHUB_CREDENTIALS,
                                    passwordVariable: 'DOCKERHUB_PASS',
                                    usernameVariable: 'DOCKERHUB_USER'
                                )]) {
                                    sh """
                                    # Tạo file xác thực cho Kaniko đẩy image lên Docker Hub
                                    mkdir -p /kaniko/.docker
                                    echo "{\\"auths\\":{\\"https://index.docker.io/v1/\\":{\\"auth\\":\\"\$(echo -n \${DOCKERHUB_USER}:\${DOCKERHUB_PASS} | base64 | tr -d '\\n')\\"}}}" > /kaniko/.docker/config.json
                                    
                                    # Chạy Kaniko executor để build và push
                                    /kaniko/executor --context `pwd` \\
                                                     --dockerfile `pwd`/Dockerfile \\
                                                     --destination ${fullImageName} \\
                                                     --destination ${latestImageName}
                                    """
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

                                sh """
                                sed -i "s/tag:.*/tag: \\"${imageTag}\\"/" values.yaml
                                """
                            }

                            withCredentials([usernamePassword(
                                credentialsId: 'github-creds',
                                passwordVariable: 'GIT_PASSWORD',
                                usernameVariable: 'GIT_USERNAME'
                            )]) {

                                sh '''
                                apk add --no-cache git
                                git config --global --add safe.directory '*'
                                git config --global user.email "jenkins@viettel.com"
                                git config --global user.name "Jenkins CI"

                                git add go-app/helm-chart/values.yaml
                                git commit -m "Jenkins Update Helm Image Tag to version ${BUILD_NUMBER} [skip ci]" || echo "No changes"

                                git pull origin main --rebase
                                git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/chuitrai/viettel-devops-app.git HEAD:main
                                '''
                            }
                        }
                    }
                }
            }
        }

        post {
            success {
                echo "Pipeline completed successfully"
            }
            failure {
                echo "Pipeline failed"
            }
        }
    }