# Статический сайт: nginx раздаёт корень репозитория как document root.
FROM nginx:1.27-alpine
COPY . /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
