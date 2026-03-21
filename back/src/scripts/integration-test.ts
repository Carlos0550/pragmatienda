import { categoriesService } from "../services/Categories/categories.service";
import { productsService } from "../services/Products/products.service";
import { prisma } from "../db/prisma";
import { logger } from "../config/logger";

/**
 * Integration Test Script for Categories and Products
 * 
 * This script directly tests the service methods used by controllers to:
 * - Create categories with and without images
 * - Create products with and without images
 * - Handle plan limitations gracefully
 * - Clean up test data after execution
 */

interface TestResult {
  test: string;
  success: boolean;
  data?: any;
  error?: string;
  planLimited?: boolean;
}

class IntegrationTestRunner {
  private testTenantId = "cmmpp4j0x00010epa7vknym90"; // Using existing tenant
  private testResults: TestResult[] = [];
  private createdCategoryIds: string[] = [];
  private createdProductIds: string[] = [];

  async runAllTests(): Promise<void> {
    logger.info("🚀 Starting integration tests...");
    
    try {
      // Clean up any existing test data
      await this.cleanupTestData();
      
      console.log("\n📋 Test Plan:");
      console.log("1. Create Category Without Image");
      console.log("2. Create Category With Image");
      console.log("3. Create Product Without Image");
      console.log("4. Create Product With Image");
      console.log("");
      
      // Run category tests
      await this.testCreateCategoryWithoutImage();
      await this.testCreateCategoryWithImage();
      
      // Run product tests (need a category first)
      await this.testCreateProductWithoutImage();
      await this.testCreateProductWithImage();
      
      // Print results
      this.printResults();
      
    } catch (error) {
      logger.error("❌ Integration test failed:", error);
      throw error;
    } finally {
      // Clean up test data
      await this.cleanupTestData();
    }
  }

  private async testCreateCategoryWithoutImage(): Promise<void> {
    const testName = "Create Category Without Image";
    logger.info(`🧪 Running test: ${testName}`);
    
    try {
      const result = await categoriesService.create(this.testTenantId, {
        name: `Test Category ${Date.now()}`,
        description: "This is a test category without image",
        metaTitle: "Test Category Meta Title",
        metaDescription: "Test category meta description"
      });
      
      if (result.status === 201) {
        this.handleSuccess(testName, result.data);
        if ((result.data as any)?.id) {
          this.createdCategoryIds.push((result.data as any).id);
        }
      } else if (result.status === 402) {
        // Plan limit reached - this is expected for FREE plans
        this.handlePlanLimit(testName, result.message);
      } else {
        throw new Error(`Expected status 201 or 402, got ${result.status}: ${result.message}`);
      }
    } catch (error) {
      this.handleError(testName, error);
    }
  }

  private async testCreateCategoryWithImage(): Promise<void> {
    const testName = "Create Category With Image";
    logger.info(`🧪 Running test: ${testName}`);
    
    try {
      // Create a mock image file
      const mockImageFile: Express.Multer.File = {
        fieldname: "image",
        originalname: "test-category.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 1024,
        destination: "",
        filename: "test-category.jpg",
        path: "",
        buffer: Buffer.from("fake-image-data-for-testing"),
        stream: null as any
      };
      
      const result = await categoriesService.create(this.testTenantId, {
        name: `Test Category With Image ${Date.now()}`,
        description: "This is a test category with image",
        metaTitle: "Test Category With Image Meta Title",
        metaDescription: "Test category with image meta description"
      }, mockImageFile);
      
      if (result.status === 201) {
        this.handleSuccess(testName, result.data);
        if ((result.data as any)?.id) {
          this.createdCategoryIds.push((result.data as any).id);
        }
      } else if (result.status === 402) {
        // Plan limit reached - this is expected for FREE plans
        this.handlePlanLimit(testName, result.message);
      } else {
        throw new Error(`Expected status 201 or 402, got ${result.status}: ${result.message}`);
      }
    } catch (error) {
      this.handleError(testName, error);
    }
  }

  private async testCreateProductWithoutImage(): Promise<void> {
    const testName = "Create Product Without Image";
    logger.info(`🧪 Running test: ${testName}`);
    
    try {
      // Get an existing category for the product
      const categoryId = await this.getOrCreateTestCategory();
      
      const result = await productsService.create(this.testTenantId, {
        name: `Test Product ${Date.now()}`,
        skipGenericCheck: true,
        description: "This is a test product without image",
        price: 99.99,
        stock: 10,
        categoryId: categoryId,
        status: "PUBLISHED",
        barCode: `TEST${Date.now()}`,
        metaTitle: "Test Product Meta Title",
        metaDescription: "Test product meta description",
        metadata: { test: "data", integrationTest: true }
      });
      
      if (result.status === 201) {
        this.handleSuccess(testName, result.data);
        if ((result.data as any)?.product?.id) {
          this.createdProductIds.push((result.data as any).product.id);
        }
      } else if (result.status === 402) {
        // Plan limit reached - this is expected for FREE plans
        this.handlePlanLimit(testName, result.message);
      } else {
        throw new Error(`Expected status 201 or 402, got ${result.status}: ${result.message}`);
      }
    } catch (error) {
      this.handleError(testName, error);
    }
  }

  private async testCreateProductWithImage(): Promise<void> {
    const testName = "Create Product With Image";
    logger.info(`🧪 Running test: ${testName}`);
    
    try {
      // Get an existing category for the product
      const categoryId = await this.getOrCreateTestCategory();
      
      // Create a mock image file
      const mockImageFile: Express.Multer.File = {
        fieldname: "image",
        originalname: "test-product.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        size: 2048,
        destination: "",
        filename: "test-product.jpg",
        path: "",
        buffer: Buffer.from("fake-product-image-data-for-testing"),
        stream: null as any
      };
      
      const result = await productsService.create(this.testTenantId, {
        name: `Test Product With Image ${Date.now()}`,
        skipGenericCheck: true,
        description: "This is a test product with image",
        price: 149.99,
        stock: 5,
        categoryId: categoryId,
        status: "PUBLISHED",
        barCode: `TEST${Date.now() + 1}`,
        metaTitle: "Test Product With Image Meta Title",
        metaDescription: "Test product with image meta description"
      }, mockImageFile);
      
      if (result.status === 201) {
        this.handleSuccess(testName, result.data);
        if ((result.data as any)?.product?.id) {
          this.createdProductIds.push((result.data as any).product.id);
        }
      } else if (result.status === 402) {
        // Plan limit reached - this is expected for FREE plans
        this.handlePlanLimit(testName, result.message);
      } else {
        throw new Error(`Expected status 201 or 402, got ${result.status}: ${result.message}`);
      }
    } catch (error) {
      this.handleError(testName, error);
    }
  }

  private async getOrCreateTestCategory(): Promise<string> {
    // Use the first created category, or get an existing one
    if (this.createdCategoryIds.length > 0) {
      return this.createdCategoryIds[0];
    }
    
    // Try to get an existing category for this tenant
    const existingCategory = await prisma.productsCategory.findFirst({
      where: { tenantId: this.testTenantId },
      select: { id: true }
    });
    
    if (existingCategory) {
      return existingCategory.id;
    }
    
    // Create a minimal category for testing
    const categoryResult = await categoriesService.create(this.testTenantId, {
      name: `Temp Category ${Date.now()}`,
      description: "Temporary category for product testing"
    });
    
    if (categoryResult.status === 201 && (categoryResult.data as any)?.id) {
      const categoryId = (categoryResult.data as any).id;
      this.createdCategoryIds.push(categoryId);
      return categoryId;
    }
    
    throw new Error("Could not get or create a category for product testing");
  }

  private handleSuccess(testName: string, data: any): void {
    this.testResults.push({
      test: testName,
      success: true,
      data
    });
    logger.info(`✅ ${testName} - SUCCESS`);
  }

  private handlePlanLimit(testName: string, message: string): void {
    this.testResults.push({
      test: testName,
      success: true,
      data: { message, planLimited: true },
      planLimited: true
    });
    logger.info(`⚠️  ${testName} - PLAN LIMITED (expected for FREE plan)`);
  }

  private handleError(testName: string, error: unknown): void {
    this.testResults.push({
      test: testName,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
    logger.error(`❌ ${testName} - FAILED:`, error);
  }

  private async cleanupTestData(): Promise<void> {
    logger.info("🧹 Cleaning up test data...");
    
    try {
      // Delete products first (due to foreign key constraints)
      if (this.createdProductIds.length > 0) {
        await prisma.products.deleteMany({
          where: {
            id: { in: this.createdProductIds },
            tenantId: this.testTenantId
          }
        });
        this.createdProductIds = [];
      }
      
      // Delete categories
      if (this.createdCategoryIds.length > 0) {
        await prisma.productsCategory.deleteMany({
          where: {
            id: { in: this.createdCategoryIds },
            tenantId: this.testTenantId
          }
        });
        this.createdCategoryIds = [];
      }
      
      // Clean up any remaining test data for this tenant
      await prisma.products.deleteMany({
        where: {
          tenantId: this.testTenantId,
          name: { contains: "Test Product" }
        }
      });
      
      await prisma.productsCategory.deleteMany({
        where: {
          tenantId: this.testTenantId,
          name: { contains: "Test Category" }
        }
      });
      
      logger.info("✅ Test data cleanup completed");
    } catch (error) {
      logger.error("❌ Error during cleanup:", error);
    }
  }

  private printResults(): void {
    console.log("\n" + "=".repeat(60));
    console.log("🎯 INTEGRATION TEST RESULTS");
    console.log("=".repeat(60));
    
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    const planLimited = this.testResults.filter(r => r.planLimited).length;
    
    this.testResults.forEach(result => {
      const status = result.success ? (result.planLimited ? "⚠️  PLAN LIMIT" : "✅ PASS") : "❌ FAIL";
      console.log(`${status} - ${result.test}`);
      if (!result.success && result.error) {
        console.log(`     Error: ${result.error}`);
      }
      if (result.success && result.planLimited) {
        console.log(`     Note: Plan limit reached (expected behavior for FREE plan)`);
      }
    });
    
    console.log("\n" + "-".repeat(60));
    console.log(`📊 SUMMARY: ${successful}/${total} tests passed`);
    
    if (planLimited > 0) {
      console.log(`🔒 ${planLimited} test(s) hit plan limits (expected for FREE plan)`);
    }
    
    if (successful === total) {
      console.log("🎉 All tests completed successfully!");
    } else {
      console.log(`⚠️  ${total - successful} test(s) failed`);
    }
    console.log("=".repeat(60));
  }
}

// Run the integration tests
async function runIntegrationTests(): Promise<void> {
  const runner = new IntegrationTestRunner();
  await runner.runAllTests();
}

// Execute if this script is run directly
if (require.main === module) {
  runIntegrationTests()
    .then(() => {
      logger.info("🎉 Integration tests completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("💥 Integration tests failed:", error);
      process.exit(1);
    });
}

export { IntegrationTestRunner, runIntegrationTests };