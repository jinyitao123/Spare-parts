FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY bin/mcpserver /mcpserver
EXPOSE 9090
CMD ["/mcpserver"]
