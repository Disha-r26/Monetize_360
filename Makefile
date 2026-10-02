.PHONY: install test test-engine test-api test-guards run-api run-web clean

install:
	python -m pip install -r requirements.txt
	cd apps/web && npm install

test: test-guards test-engine test-api

test-guards:
	python -m pytest tests/test_architecture_guards.py -v

test-engine:
	python -m pytest engine/tests -v

test-api:
	python -m pytest apps/api/tests -v

run-api:
	python -m uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload

run-web:
	cd apps/web && npm run dev

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
