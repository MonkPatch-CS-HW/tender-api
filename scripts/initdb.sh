#!/bin/bash

PORT=5432
PGPASSWORD=postgres
PGDB=postgres
NAME=postgres

existing=$(docker ps -a --filter="name=$NAME" --format="{{.ID}}")
if [ -n "$existing" ]; then
	docker rm -f "$existing" &>/dev/null
	echo "removed container with name $NAME"
fi

running=$(docker ps --filter="expose=$PORT" --format="{{.ID}}")
if [ -n "$running" ]; then
	docker stop "$running"
	echo "stopped container on port $PORT"
fi

if id=$(docker run --name "$NAME" -p "$PORT":5432 -e POSTGRES_PASSWORD="$PGPASSWORD" \
	-d "$PGDB" -c log_statement=all); then
	echo "created new container ${id:0:12}"

	dir="$(dirname "${BASH_SOURCE[0]}")"
	while ! PGPASSWORD="$PGPASSWORD" docker exec -i "$id" psql -U postgres <"$dir/dbdump.sql" &>/dev/null; do :; done

	echo "filled data"
fi
