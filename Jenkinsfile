pipeline {
    agent {
        kubernetes {
            yaml '''
            apiVersion: v1
            kind: Pod
            spec:
              containers:
              - name: node
                image: node:20-alpine
                command:
                - cat
                tty: true
              - name: docker
                image: docker:dind
                securityContext:
                  privileged: true
                env:
                - name: DOCKER_TLS_CERTDIR
                  value: ""
            '''
        }
    }

    environment {
        DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
        DOCKER_IMAGE = 'chuitrai2901/viettel-vdt-app' // Sửa 'chuitrai' thành username Dockerhub
        APP_NAME = 'viettel-vdt-app'
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/chuitrai/viettel-devops-app.git'
            }
        }

        stage('Test & Lint') {
            steps {
                container('node') {
                    dir('app') {
                        sh 'npm ci'
                        sh 'npm run lint'
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
                        sleep 5

                        dir('app') {
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
        
        stage('Update K8s Manifest') {
            steps {
                container('docker') {
                    script {
                        def imageTag = "${env.BUILD_NUMBER}"
                        def fullImageName = "${env.DOCKER_IMAGE}:${imageTag}"
                        
                        dir('app/k8s') {
                            // Sửa file deployment yaml bằng sed để cập nhật dòng image
                            sh "sed -i 's|image: .*|image: ${fullImageName}|g' app-deploy.yaml"
                        }

                        // Push lại file đã sửa version lên Github để ArgoCD tự đọc
                        withCredentials([usernamePassword(credentialsId: 'github-creds', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME')]) {
                            sh '''
                                git config --global user.email "jenkins@viettel.com"
                                git config --global user.name "Jenkins CI"
                                git add app/k8s/app-deploy.yaml
                                git commit -m "Jenkins Update Image to version ${BUILD_NUMBER} [skip ci]" || echo "No changes to commit"
                                git push origin HEAD:main
                            '''
                        }
                    }
                }
            }
        }
    }
}
