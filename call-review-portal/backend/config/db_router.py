class ClickHouseRouter:

    def db_for_read(self, model, **hints):
        if model.__name__ == "CallCH":
            return "clickhouse"
        return None

    def db_for_write(self, model, **hints):
        if model.__name__ == "CallCH":
            return "clickhouse"
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if model_name == "callch":
            return False
        return db == "default"