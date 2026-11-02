using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "readings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_id = table.Column<Guid>(type: "uuid", nullable: false),
                    started_on = table.Column<DateOnly>(type: "date", nullable: false),
                    finished_on = table.Column<DateOnly>(type: "date", nullable: true),
                    page = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_readings", x => x.id);
                    table.CheckConstraint("ck_readings_page", "page >= 0");
                    table.ForeignKey(
                        name: "fk_readings_shelf_entries_user_id_book_id",
                        columns: x => new { x.user_id, x.book_id },
                        principalTable: "shelf_entries",
                        principalColumns: new[] { "user_id", "book_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "progress_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    reading_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    book_id = table.Column<Guid>(type: "uuid", nullable: false),
                    read_on = table.Column<DateOnly>(type: "date", nullable: false),
                    logged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    page = table.Column<int>(type: "integer", nullable: false),
                    pages = table.Column<int>(type: "integer", nullable: false),
                    finished = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_progress_entries", x => x.id);
                    table.CheckConstraint("ck_progress_entries_page", "page >= 0");
                    table.CheckConstraint("ck_progress_entries_pages", "pages >= 0");
                    table.ForeignKey(
                        name: "fk_progress_entries_readings_reading_id",
                        column: x => x.reading_id,
                        principalTable: "readings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_progress_entries_reading_id",
                table: "progress_entries",
                column: "reading_id");

            migrationBuilder.CreateIndex(
                name: "ix_progress_entries_user_id_read_on",
                table: "progress_entries",
                columns: new[] { "user_id", "read_on" });

            migrationBuilder.CreateIndex(
                name: "ix_readings_one_in_progress",
                table: "readings",
                columns: new[] { "user_id", "book_id" },
                unique: true,
                filter: "finished_on IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_readings_user_id_finished_on",
                table: "readings",
                columns: new[] { "user_id", "finished_on" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "progress_entries");

            migrationBuilder.DropTable(
                name: "readings");
        }
    }
}
