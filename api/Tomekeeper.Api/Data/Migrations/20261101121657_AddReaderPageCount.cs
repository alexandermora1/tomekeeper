using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReaderPageCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "page_count",
                table: "shelf_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_shelf_entries_page_count",
                table: "shelf_entries",
                sql: "page_count IS NULL OR page_count BETWEEN 1 AND 20000");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_shelf_entries_page_count",
                table: "shelf_entries");

            migrationBuilder.DropColumn(
                name: "page_count",
                table: "shelf_entries");
        }
    }
}
