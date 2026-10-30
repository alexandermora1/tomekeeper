using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tomekeeper.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPortraitAndGoals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "portrait",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "reading_goals",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    pages = table.Column<int>(type: "integer", nullable: true),
                    books = table.Column<int>(type: "integer", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reading_goals", x => new { x.user_id, x.year });
                    table.CheckConstraint("ck_reading_goals_books", "books IS NULL OR books BETWEEN 1 AND 1000");
                    table.CheckConstraint("ck_reading_goals_has_target", "pages IS NOT NULL OR books IS NOT NULL");
                    table.CheckConstraint("ck_reading_goals_pages", "pages IS NULL OR pages BETWEEN 1 AND 100000");
                    table.ForeignKey(
                        name: "fk_reading_goals_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reading_goals");

            migrationBuilder.DropColumn(
                name: "portrait",
                table: "users");
        }
    }
}
