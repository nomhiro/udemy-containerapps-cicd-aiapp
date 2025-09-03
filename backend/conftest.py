def pytest_addoption(parser):  # type: ignore
    parser.addoption(
        "--run-live-cosmos",
        action="store_true",
        default=False,
        help="Run tests that hit a real Cosmos DB instance",
    )

def pytest_configure(config):  # type: ignore
    config.addinivalue_line("markers", "live_cosmos: mark test as using real Cosmos DB")